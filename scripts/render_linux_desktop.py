#!/usr/bin/env python3
"""Render app-owned Linux desktop entries without dropping launch actions."""
import argparse
import configparser
import os
import re
import tempfile
from pathlib import Path


def render_desktop(source, executable):
    if not re.fullmatch(r'(?:/[A-Za-z0-9_.-]+)+|[A-Za-z0-9_-][A-Za-z0-9_.-]*', executable):
        raise ValueError('Executable must be an absolute path or a plain binary name')
    if any(part in {'.', '..'} for part in executable.split('/')):
        raise ValueError('Executable must not contain relative directory segments')
    document = configparser.ConfigParser(interpolation=None)
    document.optionxform = str
    document.read_string(source)
    if not document.has_section('Desktop Entry'):
        raise ValueError('Missing Desktop Entry section')
    actions = document.get('Desktop Entry', 'Actions', fallback='').split(';')
    for action in filter(None, actions):
        if not document.has_section(f'Desktop Action {action}'):
            raise ValueError(f'Missing Desktop Action {action} section')
    sections = [name for name in document.sections()
                if name == 'Desktop Entry' or name.startswith('Desktop Action ')]
    for section in sections:
        command = document.get(section, 'Exec', fallback='').strip()
        if not command or '\n' in command:
            raise ValueError(f'Missing or invalid Exec in {section}')
    # Keep labels, icons, arguments, field codes and comments; strip insignificant line whitespace.
    result, count = re.subn(r'(?m)^Exec=[^ \t\r\n]+([ \t][^\r\n]*)?$',
                           lambda match: f'Exec={executable}{match[1] or ""}', source)
    if count != len(sections):
        raise ValueError('Every desktop entry/action must have one Exec line')
    return '\n'.join(line.rstrip(' \t') for line in result.splitlines()) + '\n'


def write_desktop(source, output, executable):
    if source.resolve() == output.resolve():
        raise ValueError('Generated output must not replace the source template')
    rendered = render_desktop(source.read_text(encoding='utf-8'), executable)
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=output.parent,
                                         prefix='.desktop-', delete=False) as file:
            stage = Path(file.name)
            file.write(rendered)
        stage.chmod(0o755)
        os.replace(stage, output)
    finally:
        if stage is not None:
            stage.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--executable', required=True)
    args = parser.parse_args()
    write_desktop(args.source, args.output, args.executable)


if __name__ == '__main__':
    main()
