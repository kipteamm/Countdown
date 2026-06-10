import re


def evaluate_rules(rules: list[str], numbers: dict[str, list[int]]) -> int:
    pool = (numbers.get("large", []) + numbers.get("small", [])).copy()

    final_res = -1
    for rule in rules:
        if not re.match(r"^[0-9+\-*/]+$", rule): return -1

        parts = re.split(r'[+\-*/]', rule)
        if len(parts) != 2:
            return -1

        val1, val2 = int(parts[0]), int(parts[1])

        if val1 not in pool: return -1
        pool.remove(val1)

        if val2 not in pool: return -1
        pool.remove(val2)

        res = eval(rule)

        if res <= 0 or not isinstance(res, int) or ('/' in rule and val1 % val2 != 0): return -1

        pool.append(res)
        final_res = res

    return final_res
