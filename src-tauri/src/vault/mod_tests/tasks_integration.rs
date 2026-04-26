use crate::vault::parse_md_file;
use std::io::Write;
use tempfile::NamedTempFile;

#[test]
fn parse_md_file_sets_task_count() {
    let mut f = NamedTempFile::with_suffix(".md").unwrap();
    writeln!(
        f,
        "# My Note\n\n- [ ] Open task 1\n- [x] Done task\n- [ ] Open task 2"
    )
    .unwrap();
    let entry = parse_md_file(f.path(), None).unwrap();
    assert_eq!(entry.task_count, 2);
}

#[test]
fn parse_md_file_zero_tasks_when_no_checkboxes() {
    let mut f = NamedTempFile::with_suffix(".md").unwrap();
    writeln!(f, "# Note\n\nJust a paragraph.").unwrap();
    let entry = parse_md_file(f.path(), None).unwrap();
    assert_eq!(entry.task_count, 0);
}
