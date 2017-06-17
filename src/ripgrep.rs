use base::{FileRef, Line, Project, Snippet};
use std::fs::File;
use std::io;
use std::io::prelude::Read;
use std::mem;
use std::process::Command;
use std::str;

pub fn search(project: &Project,
              query: &str,
              file_filter: &str,
              above: usize,
              below: usize)
              -> Result<Vec<Snippet>, io::Error> {
    Ok(lines_to_snippets(project,
                         rg_command(project,
                                    query,
                                    &["-g",
                                      file_filter,
                                      "-A",
                                      &above.to_string(),
                                      "-B",
                                      &below.to_string()])?))
}

pub fn file(project: &Project, query: &str, file: &str) -> io::Result<Snippet> {
    let output = rg_command(project, file, &["-e", query, "-C", "10000"])?;
    let file_ref = FileRef::new(project, file);

    if output.is_empty() {
        let lines = read_file(project, &file_ref)?
            .into_iter()
            .map(|line| Line::new(line, vec![]))
            .collect();
        Ok(Snippet::new(lines, 0, file_ref))
    } else {
        Ok(lines_to_snippet(&file_ref, output))
    }
}

fn read_file(project: &Project, file_ref: &FileRef) -> io::Result<Vec<String>> {
    let mut file = File::open(&project.path.join(&file_ref.path))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents.split('\n').map(String::from).collect())
}

fn rg_command(project: &Project, query: &str, args: &[&str]) -> io::Result<Vec<String>> {
    let result = Command::new("rg")
        .current_dir(&project.path)
        .arg("--color")
        .arg("always")
        .arg("--heading")
        .arg("-n")
        .args(args)
        .arg(query)
        .output()?;
    Ok(String::from_utf8_lossy(&result.stdout)
           .split('\n')
           .filter(|&l| !l.is_empty())
           .map(|l| l.to_string())
           .collect())
}

fn parse_line(line: &str) -> Line {
    let mut full = String::new();
    let mut char_indices = line.char_indices();
    let mut char_idx = char_indices.next();
    let mut matches = vec![];

    while let Some((idx, c)) = char_idx {
        if line[idx..].starts_with("\u{1b}[m\u{1b}[31m\u{1b}[1m") {
            for _ in 0..12 {
                char_idx = char_indices.next();
            }
            let end = line[idx + 12..]
                .find("\u{1b}[m")
                .expect("cannot find end of match") + idx + 12;
            let match_str = &line[idx + 12..end];
            matches.push((full.len(), full.len() + match_str.len()));
            full.push_str(match_str);
            for _ in 0..(end - idx - 9) {
                char_idx = char_indices.next();
            }
        } else {
            full.push(c);
            char_idx = char_indices.next();
        }
    }
    Line::new(full, matches)
}

fn lines_to_snippets(project: &Project, raw_lines: Vec<String>) -> Vec<Snippet> {
    let mut snippets = vec![];
    let mut lines: Vec<Line> = vec![];
    let mut line_number = 0;
    let mut file: Option<FileRef> = None;

    for raw_line in raw_lines {
        if raw_line == "--" {
            snippets.push(Snippet::new(mem::replace(&mut lines, vec![]),
                                       line_number,
                                       file.clone().expect("file not identified")));
            line_number = 0;
        }
        if raw_line.starts_with("\u{1b}[m\u{1b}[35m") {
            let new_file = Some(FileRef::new(project, &raw_line[8..raw_line.len() - 3]));
            if !lines.is_empty() {
                snippets.push(Snippet::new(mem::replace(&mut lines, vec![]),
                                           line_number,
                                           mem::replace(&mut file, new_file).unwrap()));
                line_number = 0;
            } else {
                file = new_file
            }
        }
        if raw_line.starts_with("\u{1b}[m\u{1b}[32m") {
            let ln_end = raw_line[8..]
                .find("\u{1b}[m")
                .expect("cannot find end of line number") + 8;
            let current_line_number = &raw_line[8..ln_end].parse::<usize>().unwrap();
            if lines.is_empty() {
                line_number = *current_line_number;
            }
            lines.push(parse_line(&raw_line[ln_end + 4..]));
        }
    }
    if !lines.is_empty() {
        snippets.push(Snippet::new(mem::replace(&mut lines, vec![]),
                                   line_number,
                                   mem::replace(&mut file, None).unwrap()));
    }
    snippets
}

fn lines_to_snippet(file: &FileRef, raw_lines: Vec<String>) -> Snippet {
    let mut lines: Vec<Line> = vec![];
    for raw_line in raw_lines {
        if raw_line.starts_with("\u{1b}[m\u{1b}[32m") {
            let ln_end = raw_line[8..]
                .find("\u{1b}[m")
                .expect("cannot find end of line number") + 8;
            lines.push(parse_line(&raw_line[ln_end + 4..]));
        }
    }
    Snippet::new(lines, 0, file.clone())
}
