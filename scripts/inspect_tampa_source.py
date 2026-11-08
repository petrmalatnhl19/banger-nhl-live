#!/usr/bin/env python3
"""Inspect exact NHL.com projected lines near Tampa Bay without inventing players."""
import html, json, re, urllib.request
from html.parser import HTMLParser
from pathlib import Path
URL="https://www.nhl.com/news/nhl-lineup-projections-2026-27-season"
class Parser(HTMLParser):
 def __init__(self): super().__init__(); self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag in ("p","h1","h2","h3","h4","li","br"): self.parts.append("\n")
 def handle_endtag(self,tag):
  if tag in ("p","h1","h2","h3","h4","li"): self.parts.append("\n")
 def handle_data(self,data): self.parts.append(data)
req=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0 (compatible; BangerNHL/1.0)"})
with urllib.request.urlopen(req,timeout=25) as response: raw=response.read().decode("utf-8","replace")
p=Parser();p.feed(re.sub(r"<(script|style)\b[^>]*>[\s\S]*?</\1>","",raw,flags=re.I))
lines=[re.sub(r"\s+"," ",html.unescape(x)).strip() for x in "".join(p.parts).splitlines()]
lines=[x for x in lines if x]
blocks=[]
for i,line in enumerate(lines):
 if re.fullmatch(r"(?:Tampa Bay )?Lightning projected (?:lineup|lines)",line,re.I):
  blocks.append({"heading":line,"followingLines":lines[i+1:i+30]})
result={"source":URL,"blocks":blocks,"warning":"Raw source excerpts for debugging only; no roster changes."}
Path("tampa_source_excerpt.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(result,ensure_ascii=False,indent=2))
