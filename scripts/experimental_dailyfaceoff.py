#!/usr/bin/env python3
"""Experimental Daily Faceoff lineup importer. DRY RUN ONLY.

Writes dailyfaceoff_preview.json, never lineups.json. Run manually after
checking Daily Faceoff's applicable access/reuse terms. No automated polling.
"""
import argparse
import datetime as dt
import json
import re
import urllib.request
from html.parser import HTMLParser

TEAMS = {
 "ANA":"anaheim-ducks","BOS":"boston-bruins","BUF":"buffalo-sabres",
 "CAR":"carolina-hurricanes","CBJ":"columbus-blue-jackets",
 "CGY":"calgary-flames","CHI":"chicago-blackhawks","COL":"colorado-avalanche",
 "DAL":"dallas-stars","DET":"detroit-red-wings","EDM":"edmonton-oilers",
 "FLA":"florida-panthers","LAK":"los-angeles-kings","MIN":"minnesota-wild",
 "MTL":"montreal-canadiens","NJD":"new-jersey-devils",
 "NSH":"nashville-predators","NYI":"new-york-islanders",
 "NYR":"new-york-rangers","OTT":"ottawa-senators",
 "PHI":"philadelphia-flyers","PIT":"pittsburgh-penguins",
 "SEA":"seattle-kraken","SJS":"san-jose-sharks",
 "STL":"st-louis-blues","TBL":"tampa-bay-lightning",
 "TOR":"toronto-maple-leafs","UTA":"utah-mammoth",
 "VAN":"vancouver-canucks","VGK":"vegas-golden-knights",
 "WPG":"winnipeg-jets","WSH":"washington-capitals",
}

class Text(HTMLParser):
 def __init__(self):
  super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ("script","style","noscript"):self.skip+=1
  if not self.skip and tag in ("h1","h2","h3","h4","p","li","br","div","section"):
   self.parts.append("\n")
 def handle_endtag(self,tag):
  if tag in ("script","style","noscript"):self.skip=max(0,self.skip-1)
  if not self.skip and tag in ("h1","h2","h3","h4","p","li","div","section"):
   self.parts.append("\n")
 def handle_data(self,data):
  if not self.skip:self.parts.append(data)

def parse(html,abbr,url):
 p=Text();p.feed(html)
 lines=[re.sub(r"\s+"," ",s).strip() for s in "".join(p.parts).splitlines()]
 lines=[s for s in lines if s]
 # Guard against reading marketing/SEO prose as player names.
 def section(start,ends):
  try:i=next(i for i,s in enumerate(lines) if s.casefold()==start.casefold())
  except StopIteration:return []
  result=[]
  for s in lines[i+1:]:
   if any(s.casefold()==end.casefold() for end in ends):break
   result.append(s)
  return result
 fw=section("Forwards",["Defensive Pairings","Defense","Goalies"])
 df=section("Defensive Pairings",["Click player jersey for news, stats and more!","1st Powerplay Unit","Goalies"])
 # This plain-text parser intentionally does not guess player boundaries.
 # The structured team chart needs DOM-aware extraction and roster validation.
 updated=re.search(r"Last updated:\s*(\d{4}-\d\d-\d\dT[^\s<]+)",html)
 stamp=updated.group(1).rstrip('",') if updated else None
 return {"team":abbr,"source":url,"sourceUpdatedAt":stamp,
         "retrievedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
         "forwards":[],"defense":[],"goalies":[],
         "status":"needs_structured_parser_and_roster_validation",
         "diagnostic":{"forwardsTextEntries":len(fw),"defenseTextEntries":len(df)}}

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--team",choices=sorted(TEAMS),default="OTT")
 ap.add_argument("--output",default="dailyfaceoff_preview.json")
 args=ap.parse_args()
 url="https://www.dailyfaceoff.com/teams/"+TEAMS[args.team]+"/line-combinations"
 req=urllib.request.Request(url,headers={"User-Agent":"BangerNHL-Experimental-Importer/0.1","Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=20) as response:
  if response.status!=200:raise RuntimeError("HTTP "+str(response.status))
  raw=response.read(2_000_000).decode("utf-8","replace")
 result=parse(raw,args.team,url)
 with open(args.output,"w",encoding="utf-8") as f:
  json.dump(result,f,ensure_ascii=False,indent=2)
 print("Saved diagnostic preview:",args.output)
 print("No lineup data published. Requires permission review and DOM/roster validation.")

if __name__=="__main__":main()
