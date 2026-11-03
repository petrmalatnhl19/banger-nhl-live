"""Report position errors in stored NHL lineups without altering existing data."""
import json,re,unicodedata
def load(path):
 with open(path,encoding="utf-8") as f:return json.load(f).get("teams",{})
def norm(name):
 return re.sub(r"[^a-z]","",unicodedata.normalize("NFKD",name.casefold()).encode("ascii","ignore").decode())
rosters=load("nhl_rosters.json")
errors=[]
for path in ("lineups.json","lineups_archive.json"):
 for team,record in load(path).items():
  roster=rosters.get(team)
  if not roster:
   errors.append((path,team,"roster missing"));continue
  for group in ("forwards","defense","goalies"):
   valid={norm(x) for x in roster.get(group,[])}
   values=record.get(group,[])
   players=values if group=="goalies" else [x for line in values for x in line]
   for player in players:
    if norm(player) not in valid:errors.append((path,team,group+": "+player))
   if group=="forwards" and any(len(line)!=3 for line in values):errors.append((path,team,"forward line size"))
   if group=="defense" and any(len(line)!=2 for line in values):errors.append((path,team,"defensive pair size"))
print("POSITION VALIDATION:",len(errors),"issues")
for issue in errors[:80]:print("WARNING:",*issue)
