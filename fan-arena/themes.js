/* FAN-23: isolated presentation-only theme registry. No DOM, storage or network writes. */
(function(root){
'use strict';
const rows=[
['ANA','F47A38','B9975B'],['BOS','FFB81C','111111'],['BUF','FCB514','003087'],['CGY','D2001C','F1BE48'],
['CAR','CC0000','111111'],['CHI','CF0A2C','000000'],['COL','8A2432','236192'],['CBJ','5A9BD4','CE1126'],
['DAL','8FCEAE','006847'],['DET','CE1126','FFFFFF'],['EDM','FF7C1F','041E42'],['FLA','C8102E','041E42'],
['LAK','A2AAAD','111111'],['MIN','A6192E','154734'],['MTL','AF1E2D','192168'],['NSH','FFB81C','041E42'],
['NJD','CE1126','111111'],['NYI','F47D30','00539B'],['NYR','2B75D6','CE1126'],['OTT','C99A32','C52032'],
['PHI','F74902','111111'],['PIT','FCB514','111111'],['SEA','72C7E7','001628'],['SJS','6CC6CA','006D75'],
['STL','4D9ED8','FFB81C'],['TBL','5B9FE8','002868'],['TOR','6CA9F5','00205B'],['UTA','8DB6DC','111111'],
['VAN','68B8A2','00205B'],['VGK','BFA56A','333F42'],['WSH','C8102E','041E42'],['WPG','6D9BC2','041E42']];
const themes=new Map(rows.map(([code,a,b])=>[code,Object.freeze({code,accent:'#'+a,secondary:'#'+b})]));
const api=Object.freeze({codes:Object.freeze([...themes.keys()]),get:code=>themes.get(code)||null});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.BangerArenaThemes=api;
})(typeof globalThis==='object'?globalThis:this);
