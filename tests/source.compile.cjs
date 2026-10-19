const path = require('node:path');
const fs = require('node:fs');
const babel = require('@babel/core');
const jsx = require.resolve('@babel/plugin-transform-react-jsx');
const commonjs = require.resolve('@babel/plugin-transform-modules-commonjs');
const root = path.join(__dirname, '..');
const files = ['App.js', 'src/context/BleContext.js', 'src/screens/FirmwareUpdateScreen.js', 'src/screens/HomeScreen.js', 'src/screens/WorkoutRunner.js', 'src/screens/SessionsDashboard.js', 'src/Components/rep-feedback/RepFeedbackCard.js', 'src/Components/history/HistoryCards.js', 'src/Components/history/MovementSummary.js', 'src/Components/history/useSessionMovement.js'];
for (const entry of files) {
 const filename = path.join(root, entry); if (!fs.existsSync(filename)) continue;
 const source = fs.readFileSync(filename, 'utf8');
 babel.transformSync(source, { filename, babelrc: false, configFile: false, plugins: [jsx, commonjs] });
 for (const match of source.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
  const target = path.resolve(path.dirname(filename), match[1]);
  if (![target, target+'.js', target+'.tsx', target+'.ts', path.join(target,'index.js')].some(f=>fs.existsSync(f))) throw Error('Missing local import: '+target);
 }
 console.log(entry+': JSX/import checks passed');
}
