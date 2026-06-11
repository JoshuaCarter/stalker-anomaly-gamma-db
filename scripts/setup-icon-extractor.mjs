import { cpSync, mkdirSync } from "fs";
import { dirname } from "path";

// The MO2 icon-extractor plugin (PyQt6 port) lives in the USADE repo.
const pluginSource = "C:\\Source\\Other\\Universal-Stalker-Anomaly-Data-Export\\scripts\\extract-weapon-and-outfit-icons.py";
const pluginDest = "D:\\gamma0.9.5\\GAMMA\\plugins\\extract-weapon-and-outfit-icons.py";

// The deployed plugin resolves repo_root = <plugin dir>\.. = D:\gamma0.9.5\GAMMA,
// then reads its CSV from repo_root\data\export_item_icons.csv — so the CSV must land there.
const csvSource = "C:\\Source\\Other\\stalker-anomaly-gamma-db\\data\\gamma-0.9.5\\export_item_icons.csv";
const csvDest = "D:\\gamma0.9.5\\GAMMA\\data\\export_item_icons.csv";

mkdirSync(dirname(pluginDest), { recursive: true });
cpSync(pluginSource, pluginDest);
console.log(`Done — copied ${pluginSource} to ${pluginDest}`);

mkdirSync(dirname(csvDest), { recursive: true });
cpSync(csvSource, csvDest);
console.log(`Done — copied ${csvSource} to ${csvDest}`);
