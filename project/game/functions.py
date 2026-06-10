import re


def evaluate_rules(rules: list[str]) -> int:
    prev = -1
    for rule in rules:
        if not re.match(r"^[0-9+\-*/]+$", rule):
            return -1

        if prev < 0:
            prev = eval(rule)
            continue

        if not str(prev) in rule:
            return -1

        prev = eval(rule)

    return prev
