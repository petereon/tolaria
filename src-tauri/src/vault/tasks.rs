use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CheckboxTask {
    /// Absolute path to the source note file.
    pub note_path: String,
    /// Display title of the source note.
    pub note_title: String,
    /// Task text with deadline token stripped out.
    pub text: String,
    /// `true` if the checkbox is `[x]` or `[X]`.
    pub completed: bool,
    /// ISO 8601 date or datetime string (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`) if a deadline was found, else `None`.
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
    RE.get_or_init(|| {
        Regex::new(r"\bdue:(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)\b").expect("due keyword regex")
    })
}

fn at_date_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"@(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)\b").expect("at-date regex")
    })
}

fn emoji_date_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"📅(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)\b").expect("emoji date regex")
    })
}

/// Validate an ISO 8601 date (`YYYY-MM-DD`) or datetime (`YYYY-MM-DDTHH:MM`) string.
///
/// The date segment must have segments of length 4/2/2, all ASCII digits.
/// The optional time segment must be exactly `HH:MM`: length 5, colon at index 2,
/// hours in `00`-`23`, minutes in `00`-`59`.
fn is_valid_iso_deadline(s: &str) -> bool {
    let (date_part, time_part) = match s.split_once('T') {
        Some((d, t)) => (d, Some(t)),
        None => (s, None),
    };

    // Validate date segment.
    let parts: Vec<&str> = date_part.splitn(3, '-').collect();
    if parts.len() != 3 {
        return false;
    }
    let date_ok = parts[0].len() == 4
        && parts[1].len() == 2
        && parts[2].len() == 2
        && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit()));
    if !date_ok {
        return false;
    }

    // Validate optional time segment.
    if let Some(t) = time_part {
        if t.len() != 5 || t.as_bytes()[2] != b':' {
            return false;
        }
        let hh = &t[..2];
        let mm = &t[3..];
        if !hh.chars().all(|c| c.is_ascii_digit()) || !mm.chars().all(|c| c.is_ascii_digit()) {
            return false;
        }
        let hour: u8 = hh.parse().unwrap_or(255);
        let minute: u8 = mm.parse().unwrap_or(255);
        if hour > 23 || minute > 59 {
            return false;
        }
    }

    true
}

fn extract_deadline(text: &str) -> Option<String> {
    for re in &[due_keyword_re(), at_date_re(), emoji_date_re()] {
        if let Some(caps) = re.captures(text) {
            let candidate = caps[1].to_string();
            if is_valid_iso_deadline(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

fn strip_deadline_tokens(text: &str) -> String {
    let s = due_keyword_re().replace(text, "");
    let s = at_date_re().replace(&s, "");
    let s = emoji_date_re().replace(&s, "");
    // Collapse runs of whitespace left by token removal, then trim edges.
    s.split_whitespace().collect::<Vec<_>>().join(" ")
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

/// Flip the checkbox marker on `line_number` (1-based) in `content`.
///
/// Returns `Ok((new_content, new_completed_state))` if the target line is a
/// recognized checkbox list item, or `Err` if the line number is out of range
/// or the line is not a checkbox.
pub(super) fn toggle_checkbox_in_content(
    content: &str,
    line_number: usize,
) -> Result<(String, bool), String> {
    if line_number == 0 {
        return Err("line_number must be 1-based".into());
    }
    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let idx = line_number - 1;
    if idx >= lines.len() {
        return Err(format!(
            "line_number {line_number} out of range ({} lines)",
            lines.len()
        ));
    }
    let original = &lines[idx];
    let caps = checkbox_re()
        .captures(original)
        .ok_or_else(|| format!("line {line_number} is not a checkbox: {original:?}"))?;
    let marker = &caps[1];
    let new_marker = if matches!(marker, "x" | "X") { ' ' } else { 'x' };
    let new_completed = new_marker == 'x';
    // Replace only the marker character inside the matched `[?]` brackets.
    let bracket_start = original.find('[').expect("checkbox regex matched");
    let mut new_line = String::with_capacity(original.len());
    new_line.push_str(&original[..bracket_start + 1]);
    new_line.push(new_marker);
    new_line.push_str(&original[bracket_start + 2..]);
    lines[idx] = new_line;
    let mut new_content = lines.join("\n");
    if content.ends_with('\n') {
        new_content.push('\n');
    }
    Ok((new_content, new_completed))
}

/// Toggle the checkbox at `line_number` in the file at `note_path`.
/// Reads the file, flips the checkbox, writes it back, and returns the
/// new completed state.
pub fn toggle_task_in_file(note_path: &std::path::Path, line_number: usize) -> Result<bool, String> {
    let content = std::fs::read_to_string(note_path)
        .map_err(|e| format!("Failed to read {}: {}", note_path.display(), e))?;
    let (new_content, new_completed) = toggle_checkbox_in_content(&content, line_number)?;
    std::fs::write(note_path, new_content)
        .map_err(|e| format!("Failed to write {}: {}", note_path.display(), e))?;
    Ok(new_completed)
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

    // --- toggle tests ---

    #[test]
    fn toggle_unchecked_to_checked() {
        let content = "# Note\n\n- [ ] Buy milk\n";
        let (new_content, completed) = toggle_checkbox_in_content(content, 3).unwrap();
        assert!(completed);
        assert_eq!(new_content, "# Note\n\n- [x] Buy milk\n");
    }

    #[test]
    fn toggle_checked_to_unchecked() {
        let content = "- [x] Done\n";
        let (new_content, completed) = toggle_checkbox_in_content(content, 1).unwrap();
        assert!(!completed);
        assert_eq!(new_content, "- [ ] Done\n");
    }

    #[test]
    fn toggle_uppercase_x_becomes_unchecked() {
        let content = "- [X] Done\n";
        let (new_content, completed) = toggle_checkbox_in_content(content, 1).unwrap();
        assert!(!completed);
        assert_eq!(new_content, "- [ ] Done\n");
    }

    #[test]
    fn toggle_preserves_other_lines() {
        let content = "- [ ] First\n- [ ] Second\n- [ ] Third\n";
        let (new_content, _) = toggle_checkbox_in_content(content, 2).unwrap();
        assert_eq!(new_content, "- [ ] First\n- [x] Second\n- [ ] Third\n");
    }

    #[test]
    fn toggle_preserves_indentation_and_marker_style() {
        let content = "  * [ ] Indented asterisk\n";
        let (new_content, _) = toggle_checkbox_in_content(content, 1).unwrap();
        assert_eq!(new_content, "  * [x] Indented asterisk\n");
    }

    #[test]
    fn toggle_preserves_deadline_token() {
        let content = "- [ ] Write report due:2024-12-15\n";
        let (new_content, _) = toggle_checkbox_in_content(content, 1).unwrap();
        assert_eq!(new_content, "- [x] Write report due:2024-12-15\n");
    }

    #[test]
    fn toggle_preserves_no_trailing_newline() {
        let content = "- [ ] Task";
        let (new_content, _) = toggle_checkbox_in_content(content, 1).unwrap();
        assert_eq!(new_content, "- [x] Task");
    }

    #[test]
    fn toggle_errors_on_zero_line_number() {
        let content = "- [ ] Task\n";
        assert!(toggle_checkbox_in_content(content, 0).is_err());
    }

    #[test]
    fn toggle_errors_on_out_of_range_line() {
        let content = "- [ ] Task\n";
        assert!(toggle_checkbox_in_content(content, 99).is_err());
    }

    #[test]
    fn toggle_errors_on_non_checkbox_line() {
        let content = "Just a paragraph.\n";
        assert!(toggle_checkbox_in_content(content, 1).is_err());
    }

    #[test]
    fn toggle_task_in_file_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("note.md");
        std::fs::write(&path, "- [ ] Task A\n- [ ] Task B\n").unwrap();

        let new_state = toggle_task_in_file(&path, 2).unwrap();
        assert!(new_state);
        let after = std::fs::read_to_string(&path).unwrap();
        assert_eq!(after, "- [ ] Task A\n- [x] Task B\n");

        let new_state = toggle_task_in_file(&path, 2).unwrap();
        assert!(!new_state);
        let after = std::fs::read_to_string(&path).unwrap();
        assert_eq!(after, "- [ ] Task A\n- [ ] Task B\n");
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let content = "- [ ] Do thing due:2024-06-01\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "My Note");
        let json = serde_json::to_string(&tasks[0]).unwrap();
        assert!(json.contains("\"notePath\""), "missing notePath: {json}");
        assert!(json.contains("\"noteTitle\""), "missing noteTitle: {json}");
        assert!(json.contains("\"lineNumber\""), "missing lineNumber: {json}");
        assert!(!json.contains("\"note_path\""), "snake_case note_path present: {json}");
        assert!(!json.contains("\"note_title\""), "snake_case note_title present: {json}");
        assert!(!json.contains("\"line_number\""), "snake_case line_number present: {json}");
    }

    // --- datetime deadline tests ---

    #[test]
    fn parses_due_keyword_with_time() {
        let content = "- [ ] Write report due:2024-12-15T14:30\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, Some("2024-12-15T14:30".to_string()));
        assert_eq!(tasks[0].text, "Write report");
    }

    #[test]
    fn parses_at_form_with_time() {
        let content = "- [ ] Ship @2024-12-15T09:00\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, Some("2024-12-15T09:00".to_string()));
        assert_eq!(tasks[0].text, "Ship");
    }

    #[test]
    fn parses_emoji_form_with_time() {
        let content = "- [ ] Demo 📅2024-12-15T18:45\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, Some("2024-12-15T18:45".to_string()));
        assert_eq!(tasks[0].text, "Demo");
    }

    #[test]
    fn accepts_midnight_and_max_minute() {
        let midnight = "- [ ] Task due:2024-12-15T00:00\n";
        let tasks = extract_tasks_from_content(midnight, "/vault/note.md", "Note");
        assert_eq!(
            tasks[0].deadline,
            Some("2024-12-15T00:00".to_string()),
            "midnight (T00:00) should be accepted"
        );

        let max = "- [ ] Task due:2024-12-15T23:59\n";
        let tasks = extract_tasks_from_content(max, "/vault/note.md", "Note");
        assert_eq!(
            tasks[0].deadline,
            Some("2024-12-15T23:59".to_string()),
            "T23:59 should be accepted"
        );
    }

    #[test]
    fn rejects_invalid_hour() {
        let content = "- [ ] Bad due:2024-12-15T25:00\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, None);
        assert!(tasks[0].text.contains("due:2024-12-15T25:00"));
    }

    #[test]
    fn rejects_invalid_minute() {
        let content = "- [ ] Bad due:2024-12-15T10:60\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, None);
        assert!(tasks[0].text.contains("due:2024-12-15T10:60"));
    }

    #[test]
    fn rejects_partial_time_suffix() {
        // Only hour, no minute — the optional group requires HH:MM in full.
        // The date-only portion is still a valid deadline; time must not appear.
        let content = "- [ ] Bad due:2024-12-15T10\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert!(
            tasks[0]
                .deadline
                .as_deref()
                .map_or(true, |d| !d.contains('T')),
            "partial time suffix must not appear in deadline"
        );
    }

    #[test]
    fn strips_datetime_token_from_text() {
        let content = "- [ ] Buy milk due:2024-12-15T14:30 and bread\n";
        let tasks = extract_tasks_from_content(content, "/vault/note.md", "Note");
        assert_eq!(tasks[0].deadline, Some("2024-12-15T14:30".to_string()));
        assert_eq!(tasks[0].text, "Buy milk and bread");
    }

    #[test]
    fn toggle_preserves_datetime_token() {
        let content = "- [ ] Write report due:2024-12-15T14:30\n";
        let (new_content, _) = toggle_checkbox_in_content(content, 1).unwrap();
        assert_eq!(new_content, "- [x] Write report due:2024-12-15T14:30\n");
    }

    #[test]
    fn serializes_datetime_to_camel_case_json() {
        let task = CheckboxTask {
            note_path: "/vault/note.md".to_string(),
            note_title: "Note".to_string(),
            text: "Write report".to_string(),
            completed: false,
            deadline: Some("2024-12-15T14:30".to_string()),
            line_number: 1,
        };
        let json = serde_json::to_string(&task).expect("serialization failed");
        assert!(
            json.contains(r#""deadline":"2024-12-15T14:30""#),
            "JSON did not contain expected datetime deadline: {json}"
        );
    }
}
