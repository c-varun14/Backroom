import {inspectBuildHandoff, formatHandoffFailures} from '../../desk/src/build-stage';
import {collectHandoffEvidence, loadHandoffContract} from '../../desk/src/handoff-evidence';
import {resolve} from 'node:path';

try {
  // Base, scope and criteria come from desk's sibling, read-only contract. CLI
  // flags and files inside the product cannot replace these approved inputs.
  const contract = loadHandoffContract(resolve(import.meta.dir, '../..'), process.cwd());
  const evidence = collectHandoffEvidence(contract);
  const failures = inspectBuildHandoff({workspace:process.cwd(),criteria:contract.criteria,bug:contract.bug,reportName:'build-report.md',...evidence});
  if (failures.length) {
    console.error(formatHandoffFailures(failures));
    process.exit(1);
  }
  console.log(`PASS: build handoff ready (${contract.criteria.join(', ')}).`);
} catch {
  console.error('build-ready refused:\nFAIL: Trusted handoff contract or exact-tree evidence unavailable; ask desk to reissue the assignment.');
  process.exit(1);
}
