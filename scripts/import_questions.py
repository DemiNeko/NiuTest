"""Import the supplied test without changing its question/option wording."""
import argparse
import json
import re
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

def extract(path):
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read('word/document.xml'))
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    paragraphs = [''.join(t.text or '' for t in p.findall('.//w:t', ns))
                  for p in root.findall('.//w:body//w:p', ns)]
    blocks = []
    for paragraph in paragraphs:
        if re.match(r'^\d+\.\s', paragraph):
            blocks.append(paragraph)
        elif re.match(r'^A\)', paragraph):
            blocks[-1] += paragraph
        elif paragraph.strip() not in ('', 'Top of Form', 'Bottom of Form'):
            raise ValueError(f'Unexpected source paragraph: {paragraph}')
    questions = []
    section = 'ai'
    previous = 0
    for block in blocks:
        number, content = re.match(r'^(\d+)\.\s*(.*)$', block).groups()
        number = int(number)
        if number <= previous:
            section = 'go'
        previous = number
        parts = re.split(r'([A-D])\)', content)
        labels = parts[1::2]
        options = [text.strip() for text in parts[2::2]]
        assert labels == list('ABCD') or (section == 'go' and number == 89 and labels == list('ABC'))
        assert all(options)
        questions.append(dict(id=f'{section}-{number}', section=section, number=number,
                              question=parts[0].strip(), options=options, correctIndex=0))
    assert len(questions) == 189
    assert [q['number'] for q in questions if q['section'] == 'ai'] == list(range(1, 101))
    assert [q['number'] for q in questions if q['section'] == 'go'] == list(range(1, 90))
    notes = {
        'go-53': 'Уточнение: len() возвращает число элементов коллекции, а для строки — число байтов, не обязательно символов. Формулировка варианта A сохранена из исходного теста.',
        'go-58': 'Уточнение: goroutine запускает функцию конкурентно. Одновременное выполнение на нескольких ядрах возможно, но не гарантируется.',
        'go-89': 'В исходном документе у этого вопроса только три варианта ответа.'
    }
    for question in questions:
        if question['id'] in notes:
            question['note'] = notes[question['id']]
        if question['id'] in ('go-53', 'go-58'):
            question['sourceUrl'] = 'https://go.dev/ref/spec#' + ('Length_and_capacity' if question['id'] == 'go-53' else 'Go_statements')
    return dict(version=1, title='AI & Go', sourceName='Microsoft Word Document.docx',
                answerKey='inferred-from-content', questions=questions)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('--output', default='assets/questions.json')
    args = parser.parse_args()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(extract(args.source), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Imported 189 questions: AI 100, Go 89. Answer key inferred; last question has 3 options.')
