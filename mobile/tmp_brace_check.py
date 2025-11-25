from pathlib import Path

text = Path('app/(tabs)/broadcast.tsx').read_text(encoding='utf-8')

stack = []
line = 1
col = 1
i = 0
n = len(text)

def advance(idx, ln, cl, ch):
    if ch == '\n':
        return idx + 1, ln + 1, 1
    return idx + 1, ln, cl + 1

while i < n:
    ch = text[i]
    nxt = text[i + 1] if i + 1 < n else ''

    if ch == '/' and nxt == '/':
        while i < n and text[i] != '\n':
            i += 1
        continue

    if ch == '/' and nxt == '*':
        i += 2
        while i + 1 < n and not (text[i] == '*' and text[i + 1] == '/'):
            i, line, col = advance(i, line, col, text[i])
        i += 2
        continue

    if ch in ('"', "'", '`'):
        quote = ch
        i += 1
        col += 1
        while i < n:
            c = text[i]
            if c == '\\':
                i += 2
                col += 2
                continue
            if c == quote:
                i += 1
                col += 1
                break
            i, line, col = advance(i, line, col, c)
        continue

    if ch == '{':
        stack.append((line, col))
    elif ch == '}':
        if stack:
            stack.pop()
        else:
            print('Extra } at line', line, 'col', col)
    i, line, col = advance(i, line, col, ch)

if stack:
    print('Unclosed { count:', len(stack))
    for ln, cl in stack[-10:]:
        print('Open { at line', ln, 'col', cl)



