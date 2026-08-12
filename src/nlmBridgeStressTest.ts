import { getNlmStatus, analyzeDocuments } from '../server/nlmBridge.ts';
import path from 'path';

const originalPath = process.env.PATH || '';
const originalPathVar = process.env.Path || '';
const mockBinDir = path.resolve('scratch_test');

process.env.PATH = `${mockBinDir}${path.delimiter}${originalPath}`;
process.env.Path = `${mockBinDir}${path.delimiter}${originalPathVar}`;
process.env.MOCK_SCENARIO = 'unauthenticated';

async function testDirect() {
  const status = await getNlmStatus();
  console.log("getNlmStatus result:", status);

  try {
    await analyzeDocuments({ files: [] });
  } catch (err: any) {
    console.log("analyzeDocuments error:", err.message, "statusCode:", err.statusCode);
  }
}

testDirect();
