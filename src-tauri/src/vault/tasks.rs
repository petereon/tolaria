use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CheckboxTask {
    /// Absolute path to the source note file.
    pub note_path: String,
    /// Display title of the source note.
    pub note_title: String,
    /// Task text with deadline token stripped out.
    pub text: String,
    /// `true` if the checkbox is `[x]` or `[X]`.
    pub completed: bool,
    /// ISO 8601 date string (`YYYY-MM-DD`) if a deadline was found, else `None`.
    pub deadline: Option<String>,
    /// 1-based line number of this checkbox in the source file.
    pub line_number: usize,
}

fn checkbox_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"^[ \t]*(?:[-*+]|\d+\.)\s+\[([xX ])\]\s+(.+)$").expect("checkbox regex")
    })
}

fn due_keyword_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\bdue:(\d{4}-\d{2}-\d{2})\b").expect("due keyword regex"))
}

fn at_date_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"@(\d{4}-\d{2}-\d{2})\b").expect("at-date regex"))
}

fn emoji_date_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"📅(\d{4}-\d{2}-\d{2})\b").expect("emoji date regex"))
}

fn is_valid_iso_date(s: &str) -> bool {
    let parts: Vec<&str> = s.splitn(3, '-').collect();
    if parts.len() != 3 {
        return false;
    }
    parts[0].len() == 4
        && parts[1].len() == 2
        && parts[2].len() == 2
        && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit()))
}

fn extract_deadline(text: &str) -> Option<String> {
    for re in &[due_keyword_re(), at_date_re(), emoji_date_re()] {
        if let Some(caps) = re.captures(text) {
            let date = caps[1].to_string();
            if is_valid_iso_date(&date) {
                return Some(date);
            }
        }
    }
    None
}

fn strip_deadline_tokens(text: &str) -> String {
    let s = due_keyword_re().replace(text, "");
    let s = at_date_re().replace(&s, "");
    let s = emoji_date_re().replace(&s, "");
    s.trim().to_string()
}

/// Extract all checkbox tasks from markdown content.
pub(super) fn extract_tasks_from_content(
    content: &str,
    note_path: &str,
    note_title: &str,
) -> Vec<CheckboxTask> {
    let mut tasks = Vec::new();
    let mut in_code_block = false;

    for (idx, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }
        if let Some(caps) = checkbox_re().captures(line) {
            let marker = &caps[1];
            let raw_text = caps[2].trim();
            let completed = matches!(marker, "x" | "X");
            let deadline = extract_deadline(raw_text);
            let text = if deadline.is_some() {
                strip_deadline_tokens(raw_text)
            } else {
                raw_text.to_string()
            };
            tasks.push(CheckboxTask {
                note_path: note_path.to_string(),
                note_title: note_title.to_string(),
                text,
                completed,
                deadline,
                line_number: idx + 1,
            });
        }
    }
    tasks
}

/// Count open (uncompleted) tasks in content. Used for `VaultEntry.task_count`.
pub(super) fn count_open_tasks(content: &str) -> u32 {
    extract_tasks_from_content(content, "", "")
        .into_iter()
        .filter(|t| !t.completed)
        .count() as u32
}

/// Scan all `.md` files under `vault_path` and return every checkbox task found.
///
/// # Sort order
/// Open tasks first → deadline ascending (None last) → note path → line number.
///
/// # Errors
/// Returns `Err` if `vault_path` does not exist or is not a directory.
pub fn get_all_vault_tasks(vault_path: &std::path::Path) -> Result<Vec<CheckboxTask>, String> {
    if !vault_path.exists() || !vault_path.is_dir() {
        return Err(format!(
            "Vault path does not exist: {}",
            vault_path.display()
        ));
    }

    let mut all_tasks = Vec::new();

    let walker = walkdir::WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() && e.depth() > 0 {
                let name = e.file_name().to_string_lossy();
                return !name.starts_with('.');
            }
            true
        });

    for entry in walker.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !super::is_md_file(path) {
            continue;
        }
        let fname = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        if fname.starts_with('.') {
            continue;
        }
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let title = super::derive_markdown_title_from_content(&content, &fname);
        let note_path = path.to_string_lossy().to_string();
        let tasks = extract_tasks_from_content(&content, &note_path, &title);
        all_tasks.extend(tasks);
    }

    all_tasks.sort_by(|a, b| {
        a.completed
            .cmp(&b.completed)
            .then_with(|| match (&a.deadline, &b.deadline) {
                (Some(da), Some(db)) => da.cmp(db),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => std::cmp::Ordering::Equal,
            })
            .then_with(|| a.note_path.cmp(&b.note_path))
            .then_with(|| a.line_number.cmp(&b.line_number))
    });

    Ok(all_tasks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_unchecked_dash_item() {
        let content = "# Note\n\n- [ ] Buy milk\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].text, "Buy milk");
        assert!(!tasks[0].completed);
        assert_eq!(tasks[0].deadline, None);
        assert_eq!(tasks[0].line_number, 3);
    }

    #[test]
    fn parses_checked_item() {
        let content = "- [x] Done task\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks.len(), 1);
        assert!(tasks[0].completed);
    }

    #[test]
    fn parses_uppercase_x_as_completed() {
        let content = "- [X] Also done\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert!(tasks[0].completed);
    }

    #[test]
    fn parses_asterisk_and_plus_markers() {
        let content = "* [ ] Asterisk task\n+ [ ] Plus task\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks.len(), 2);
    }

    #[test]
    fn parses_due_keyword_deadline() {
        let content = "- [ ] Write report due:2024-12-15\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, Some("2024-12-15".to_string()));
        assert_eq!(tasks[0].text, "Write report");
    }

    #[test]
    fn parses_at_date_deadline() {
        let content = "- [ ] Write report @2024-12-15\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, Some("2024-12-15".to_string()));
        assert_eq!(tasks[0].text, "Write report");
    }

    #[test]
    fn parses_emoji_date_deadline() {
        let content = "- [ ] Write report 📅2024-12-15\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, Some("2024-12-15".to_string()));
        assert_eq!(tasks[0].text, "Write report");
    }

    #[test]
    fn ignores_invalid_date_format() {
        let content = "- [ ] Write report due:not-a-date\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, None);
        assert!(tasks[0].text.contains("due:not-a-date"));
    }

    #[test]
    fn skips_non_checkbox_list_items() {
        let content = "- Regular item\n- [ ] Task\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks.len(), 1);
    }

    #[test]
    fn skips_indented_checkboxes_inside_code_blocks() {
        let content = "```\n- [ ] not a task\n```\n- [ ] real task\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].text, "real task");
    }

    #[test]
    fn count_open_tasks_returns_only_unchecked() {
        let content = "- [ ] Open\n- [x] Done\n- [ ] Also open\n";
        assert_eq!(count_open_tasks(content), 2);
    }

    #[test]
    fn note_path_and_title_are_propagated() {
        let content = "- [ ] Task\n";
        let tasks = extract_tasks_from_content(content, "/vault/my-note.md", "My Note");
        assert_eq!(tasks[0].note_path, "/vault/my-note.md");
        assert_eq!(tasks[0].note_title, "My Note");
    }
}
