#!/usr/bin/env python3
"""Deprecated generator: validate canonical practice data without rewriting anything."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import sys
import unicodedata
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent
CANONICAL = BASE.parents[1] / 'outputs/slavonic-demo/practice-data.js'
ALLOWED = {'azbuka','znaki','pravopisanie','titla','cifir','chisla','chtenie','grammatika','imena','glagol','sintaksis'}
PARTS = ['lessons-1-3.json','lessons-4-9.json','lessons-10-18.json','smirnova-lessons.json']


def words(text: str) -> list[str]:
    result = []
    word = ''
    for char in text:
        if unicodedata.category(char)[0] in ('L', 'M'):
            word += char
        elif word:
            result.append(word)
            word = ''
    if word:
        result.append(word)
    return result


def validate(source: Path = CANONICAL) -> dict:
    script = source.read_text(encoding='utf-8')
    match = re.search(r'window\.PRACTICE_DATA\s*=\s*(\[.*\])\s*;\s*$', script, re.S)
    if not match:
        raise ValueError('Canonical practice-data.js must contain a JSON data assignment')
    lessons = json.loads(match[1])
    if not isinstance(lessons, list):
        raise ValueError('Practice data must be a list')
    if [l['number'] for l in lessons if l['id'].startswith('kp-')] != list(range(1,19)) or [l['number'] for l in lessons if l['id'].startswith('sm-')] != list(range(1,5)):
        raise ValueError('Expected 18 textbook lessons and 4 table topics')
    ids, question_ids, counts = set(), set(), {'choice':0,'input':0,'select-words':0}
    for lesson in lessons:
        if lesson['id'] in ids:
            raise ValueError('Duplicate lesson ID')
        ids.add(lesson['id'])
        url = urlparse(lesson['source']['url'])
        if url.scheme != 'https' or url.hostname != 'azbyka.ru' or not lesson['source']['chapter'] or not lesson['source']['basis']:
            raise ValueError(f'Invalid source for {lesson["id"]}')
        for q in lesson['questions']:
            if q['id'] in question_ids or not all(isinstance(q.get(key),str) and q[key].strip() for key in ('q','note','rule')) or q['rule'] not in ALLOWED:
                raise ValueError(f'Invalid question metadata: {q.get("id")}')
            question_ids.add(q['id'])
            kind = q.get('type','choice')
            if kind not in counts:
                raise ValueError(f'Unknown question type: {kind}')
            counts[kind] += 1
            if kind == 'choice':
                if len(q['a']) != 4 or len(set(q['a'])) != 4 or type(q['correct']) is not int or not 0 <= q['correct'] < 4:
                    raise ValueError(f'Invalid options: {q["id"]}')
            elif kind == 'input':
                if not q.get('accept') or not all(isinstance(value,str) and value.strip() for value in q['accept']):
                    raise ValueError(f'Input has no accepted spelling: {q["id"]}')
            else:
                token_ids = {'w'+str(i) for i,_ in enumerate(words(q['text']))}
                reasons = [r['id'] for r in q.get('reasons',[])]
                if not q.get('correctWords') or not set(q['correctWords']) <= token_ids or len(set(reasons)) != len(reasons) or not set(q.get('correctReasons',[])) <= set(reasons):
                    raise ValueError(f'Invalid word selection key: {q["id"]}')
            if '\ufffd' in json.dumps(q,ensure_ascii=False):
                raise ValueError(f'Unicode replacement character: {q["id"]}')
    original_ids = {q['id'] for part in PARTS for lesson in json.loads((BASE/part).read_text(encoding='utf-8')) for q in lesson['questions']}
    if not original_ids <= question_ids or counts['input'] < 2 or counts['select-words'] < 2:
        raise ValueError('Canonical practice is missing original questions or the new exercise types; refuse a rollback')
    return {'mode':'validate-only','deprecated':True,'lessons':len(lessons),'questions':len(question_ids),'types':counts}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compatibility flag; this command is always read-only')
    parser.add_argument('--source', type=Path, default=CANONICAL, help='Canonical data file to validate')
    args = parser.parse_args()
    print('Старый генератор отключён: canonical practice-data.js проверяется без перезаписи. Для подготовки приложений используйте prepare_release.py.',file=sys.stderr)
    try:
        report = validate(args.source)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(1, f'{exc}\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
