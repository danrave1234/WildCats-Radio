from pathlib import Path
text = Path('app/(tabs)/broadcast.tsx').read_text(encoding='utf-8')
stack = []
extra_closes = []
for i, ch in enumerate(text):
    if ch == '{':
        stack.append(i)
    elif ch == '}':
        if stack:
            stack.pop()
        else:
            extra_closes.append(i)
if extra_closes:
    for pos in extra_closes:
        line = text.count('\n', 0, pos) + 1
        col = pos - text.rfind('\n', 0, pos)
        print('Extra } at line', line, 'col', col)
if stack:
    print('Unclosed { count:', len(stack))
    for pos in stack[-10:]:
        line = text.count('\n', 0, pos) + 1
        col = pos - text.rfind('\n', 0, pos)
        print('Open { at line', line, 'col', col)
