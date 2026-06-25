import json
import re

transcript_path = r'C:\Users\rodd\.gemini\antigravity\brain\28d32181-ff96-4eeb-843c-6a633a5246df\.system_generated\logs\transcript_full.jsonl'
output_dict = {}

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            entry = json.loads(line)
            # check if it's a tool response for view_file on App.tsx
            if entry.get('type') == 'TOOL_RESPONSE':
                content = entry.get('content', '')
                if 'Showing lines' in content and 'App.tsx' in content:
                    lines = content.split('\n')
                    for l in lines:
                        match = re.match(r'^(\d+):\s(.*)', l)
                        if match:
                            output_dict[int(match.group(1))] = match.group(2)
        except Exception as e:
            pass

lines = [output_dict.get(i, '') for i in range(1, max(output_dict.keys() or [0]) + 1)]

with open('App_original.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Recovered {len(lines)} lines to App_original.tsx')
