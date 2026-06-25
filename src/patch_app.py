import os

with open('App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Timestamps default
text = text.replace('const [showTimestamps, setShowTimestamps] = useState(true);', 'const [showTimestamps, setShowTimestamps] = useState(false);')
text = text.replace('const showTimestampsRef = useRef(true);', 'const showTimestampsRef = useRef(false);')

# 2. Brightness remove state
text = text.replace('const [brightness, setBrightness] = useState(80);\\n', '')

# 3. Brightness remove filter
text = text.replace('                filter: `brightness(${brightness}%)`,\\n', '')

# 4. Remove Brightness Slider UI
slider_ui = '''            {/* BRIGHTNESS SLIDER */}
            <div className="mb-4 shrink-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] font-mono font-bold text-zinc-500 tracking-wider">BRIGHTNESS</span>
                <Sun className="w-3.5 h-3.5 text-zinc-400 glow-text" />
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-zinc-400 w-8 text-right tabular-nums">{brightness}%</span>
              </div>
            </div>'''
text = text.replace(slider_ui, '')

# 5. Fix Colored Logs Text
log_text = '''    const textSpan = document.createElement('span');
    textSpan.className = 'text-zinc-300 ml-1.5';
    textSpan.innerText = log.text;'''
log_text_new = '''    const textSpan = document.createElement('span');
    textSpan.className = `${log.color || 'text-zinc-300'} ml-1.5`;
    textSpan.innerText = log.text;'''
text = text.replace(log_text, log_text_new)

# 6. Add Divider Lines to OLED Panel
presets_row = '''            {/* Color Presets Row */}
            <div className="flex justify-between items-center px-1 pt-1">'''
presets_row_new = '''            <div className="h-px bg-zinc-800/80 my-3 w-full" />
            {/* Color Presets Row */}
            <div className="flex justify-between items-center px-1 pt-1">'''
text = text.replace(presets_row, presets_row_new)

settings_toggles = '''            {/* DISPLAY SETTINGS TOGGLES */}
            <div className="space-y-3 pt-2 border-t border-zinc-800/80 shrink-0">'''
settings_toggles_new = '''            <div className="h-px bg-zinc-800/80 my-3 w-full" />
            {/* DISPLAY SETTINGS TOGGLES */}
            <div className="space-y-3 shrink-0">'''
text = text.replace(settings_toggles, settings_toggles_new)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('App.tsx modifications applied')
