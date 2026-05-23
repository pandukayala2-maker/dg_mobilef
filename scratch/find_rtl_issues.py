import os
import re

target_dir = r"c:\projects\dgcards\dg_mobilef\app"
patterns = [
    r"row-reverse",
    r"justifyContent:\s*isAR\s*\?",
    r"flexDirection:\s*isAR\s*\?"
]

print("Searching for manual RTL overrides in app directory...")
for root, dirs, files in os.walk(target_dir):
    for file in files:
        if file.endswith('.jsx') or file.endswith('.js'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    for pat in patterns:
                        if re.search(pat, line):
                            print(f"{file}:{i+1}: {line.strip()}")
