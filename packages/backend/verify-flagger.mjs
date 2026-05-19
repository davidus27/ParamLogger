/**
 * Simple verification script for the flagger implementation
 */

import { assignFlags, isParameterInteresting, predictFlags, getFlagStats } from "./dist/flagger.js";
import { ParameterFlag, ValueType, ParameterLocation } from "../shared/dist/types.js";

console.log("🧪 Testing Flagger Implementation...\n");

// Test 1: Basic sensitive parameter detection
console.log("Test 1: Sensitive parameter detection");
const sensitiveFlags = assignFlags(
  "password",
  "secret123",
  ValueType.STRING,
  ParameterLocation.FORM,
  new Date(Date.now() - 48 * 60 * 60 * 1000) // 48 hours ago
);
console.log(`  password parameter flags: ${sensitiveFlags.join(', ')}`);
console.log(`  Expected SENSITIVE: ${sensitiveFlags.includes(ParameterFlag.SENSITIVE) ? '✅' : '❌'}`);

// Test 2: JWT token detection
console.log("\nTest 2: JWT token detection");
const jwtFlags = assignFlags(
  "auth_token",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  ValueType.JWT,
  ParameterLocation.HEADER,
  new Date(Date.now() - 48 * 60 * 60 * 1000)
);
console.log(`  JWT token flags: ${jwtFlags.join(', ')}`);
console.log(`  Expected SENSITIVE: ${jwtFlags.includes(ParameterFlag.SENSITIVE) ? '✅' : '❌'}`);

// Test 3: Redirect URL detection
console.log("\nTest 3: Redirect URL detection");
const redirectFlags = assignFlags(
  "callback_url",
  "https://example.com/callback",
  ValueType.URL,
  ParameterLocation.QUERY,
  new Date(Date.now() - 48 * 60 * 60 * 1000)
);
console.log(`  Redirect URL flags: ${redirectFlags.join(', ')}`);
console.log(`  Expected REDIRECT: ${redirectFlags.includes(ParameterFlag.REDIRECT) ? '✅' : '❌'}`);

// Test 4: NEW flag for recent parameters
console.log("\nTest 4: NEW flag for recent parameters");
const newFlags = assignFlags(
  "recent_param",
  "test_value",
  ValueType.STRING,
  ParameterLocation.QUERY,
  new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago (within 24h threshold)
);
console.log(`  Recent parameter flags: ${newFlags.join(', ')}`);
console.log(`  Expected NEW: ${newFlags.includes(ParameterFlag.NEW) ? '✅' : '❌'}`);

// Test 5: Multiple flag assignment
console.log("\nTest 5: Multiple flag assignment");
const multiFlags = assignFlags(
  "user_password", // AUTH (user) + SENSITIVE (password)
  "hashedValue123",
  ValueType.HASH,
  ParameterLocation.JSON,
  new Date(Date.now() - 1 * 60 * 60 * 1000) // Recent
);
console.log(`  user_password flags: ${multiFlags.join(', ')}`);
console.log(`  Expected AUTH + SENSITIVE + NEW: ${
  multiFlags.includes(ParameterFlag.AUTH) && 
  multiFlags.includes(ParameterFlag.SENSITIVE) && 
  multiFlags.includes(ParameterFlag.NEW) ? '✅' : '❌'
}`);

// Test 6: Interesting parameter detection
console.log("\nTest 6: Interesting parameter detection");
const isInteresting1 = isParameterInteresting(
  [ParameterFlag.SENSITIVE],
  0.3,
  [ValueType.STRING]
);
const isInteresting2 = isParameterInteresting(
  [],
  0.8, // High dynamic confidence
  [ValueType.STRING]
);
const isInteresting3 = isParameterInteresting(
  [ParameterFlag.NEW], // Only NEW flag
  0.3,
  [ValueType.STRING]
);
console.log(`  Parameter with SENSITIVE flag: ${isInteresting1 ? '✅ Interesting' : '❌ Not interesting'}`);
console.log(`  Parameter with high dynamic confidence: ${isInteresting2 ? '✅ Interesting' : '❌ Not interesting'}`);
console.log(`  Parameter with only NEW flag: ${isInteresting3 ? '❌ Should not be interesting' : '✅ Correctly not interesting'}`);

// Test 7: Flag prediction without values
console.log("\nTest 7: Flag prediction");
const predicted = predictFlags("api_token", ParameterLocation.HEADER);
console.log(`  Predicted flags for 'api_token': ${predicted.join(', ')}`);
console.log(`  Expected SENSITIVE: ${predicted.includes(ParameterFlag.SENSITIVE) ? '✅' : '❌'}`);

// Show statistics
console.log("\n📊 Flag Assignment Statistics:");
const stats = getFlagStats();
console.log(`  Total parameters processed: ${stats.totalParameters}`);
console.log(`  Parameters by flag:`);
for (const [flag, count] of stats.flaggedParameters) {
  console.log(`    ${flag}: ${count}`);
}
console.log(`  Name-based flags: ${stats.nameBasedFlags}`);
console.log(`  Value-based flags: ${stats.valueBasedFlags}`);
console.log(`  Time-based flags: ${stats.timeBasedFlags}`);

console.log("\n🎉 Flagger verification completed!");