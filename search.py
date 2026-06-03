import os, sys

def search_files(directory, query):
    for root, _, files in os.walk(directory):
        if 'node_modules' in root or '.git' in root or '.expo' in root:
            continue
        for file in files:
            if not file.endswith(('.js', '.jsx', '.ts', '.tsx')): continue
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f):
                        if query.lower() in line.lower():
                            print(f"{path}:{i+1}:{line.strip()}")
            except Exception:
                pass

if __name__ == '__main__':
    search_files(sys.argv[1], sys.argv[2])
