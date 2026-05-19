/**
 * Test cases for the flag engine
 */

import { assignFlags, isParameterInteresting, predictFlags, getFlagStats, resetFlagStats } from "./flagger.js";
import { ParameterFlag, ValueType, ParameterLocation } from "../../shared/dist/types.js";

/**
 * Test helper to create a date N hours ago
 */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/**
 * Test helper to run a test case and log results
 */
function runTest(name: string, testFn: () => boolean): void {
  try {
    const result = testFn();
    console.log(`✅ ${name}: ${result ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error}`);
  }
}

/**
 * Test basic name-based flagging
 */
function testNameBasedFlags(): boolean {
  const tests = [
    // Sensitive patterns
    {
      name: "password",
      location: ParameterLocation.FORM,
      expected: [ParameterFlag.SENSITIVE]
    },
    {
      name: "api_key", 
      location: ParameterLocation.HEADER,
      expected: [ParameterFlag.SENSITIVE]
    },
    {
      name: "access_token",
      location: ParameterLocation.QUERY,
      expected: [ParameterFlag.SENSITIVE]
    },
    
    // Redirect patterns
    {
      name: "redirect_url",
      location: ParameterLocation.QUERY,
      expected: [ParameterFlag.REDIRECT]
    },
    {
      name: "return_to",
      location: ParameterLocation.FORM,
      expected: [ParameterFlag.REDIRECT]
    },
    
    // File patterns
    {
      name: "filename",
      location: ParameterLocation.FORM,
      expected: [ParameterFlag.FILE]
    },
    {
      name: "upload_path",
      location: ParameterLocation.JSON,
      expected: [ParameterFlag.FILE]
    },
    
    // Auth patterns
    {
      name: "username",
      location: ParameterLocation.FORM,
      expected: [ParameterFlag.AUTH]
    },
    {
      name: "user_email",
      location: ParameterLocation.JSON,
      expected: [ParameterFlag.AUTH]
    },
  ];
  
  for (const test of tests) {
    const flags = assignFlags(
      test.name,
      "test_value",
      ValueType.STRING,
      test.location,
      hoursAgo(48) // Old parameter, no NEW flag
    );
    
    for (const expectedFlag of test.expected) {
      if (!flags.includes(expectedFlag)) {
        console.log(`Expected ${expectedFlag} flag for ${test.name}, got ${flags.join(', ')}`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Test value-based flagging
 */
function testValueBasedFlags(): boolean {
  const tests = [
    // JWT tokens should get SENSITIVE flag
    {
      name: "token",
      value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      valueType: ValueType.JWT,
      expected: [ParameterFlag.SENSITIVE]
    },
    
    // URLs should get REDIRECT flag
    {
      name: "callback",
      value: "https://example.com/callback",
      valueType: ValueType.URL,
      expected: [ParameterFlag.REDIRECT]
    },
    
    // File paths should get FILE flag
    {
      name: "document",
      value: "/uploads/document.pdf",
      valueType: ValueType.STRING,
      expected: [ParameterFlag.FILE]
    },
    
    // Emails should get AUTH flag in appropriate contexts
    {
      name: "email",
      value: "user@example.com",
      valueType: ValueType.EMAIL,
      location: ParameterLocation.FORM,
      expected: [ParameterFlag.AUTH]
    },
    
    // Base64 tokens should get SENSITIVE flag
    {
      name: "secret",
      value: "YWxhZGRpbjpvcGVuc2VzYW1l", // Base64: "aladdin:opensesame"
      valueType: ValueType.BASE64,
      expected: [ParameterFlag.SENSITIVE]
    }
  ];
  
  for (const test of tests) {
    const flags = assignFlags(
      test.name,
      test.value,
      test.valueType,
      test.location || ParameterLocation.QUERY,
      hoursAgo(48) // Old parameter
    );
    
    for (const expectedFlag of test.expected) {
      if (!flags.includes(expectedFlag)) {
        console.log(`Expected ${expectedFlag} flag for value ${test.value}, got ${flags.join(', ')}`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Test time-based NEW flag
 */
function testNewFlag(): boolean {
  // Recent parameter should get NEW flag
  const recentFlags = assignFlags(
    "test_param",
    "test_value", 
    ValueType.STRING,
    ParameterLocation.QUERY,
    hoursAgo(1) // 1 hour ago (within 24h threshold)
  );
  
  if (!recentFlags.includes(ParameterFlag.NEW)) {
    console.log(`Expected NEW flag for recent parameter, got ${recentFlags.join(', ')}`);
    return false;
  }
  
  // Old parameter should NOT get NEW flag
  const oldFlags = assignFlags(
    "old_param",
    "test_value",
    ValueType.STRING, 
    ParameterLocation.QUERY,
    hoursAgo(48) // 48 hours ago (beyond 24h threshold)
  );
  
  if (oldFlags.includes(ParameterFlag.NEW)) {
    console.log(`Did not expect NEW flag for old parameter, got ${oldFlags.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Test location-specific flagging
 */
function testLocationSpecificFlags(): boolean {
  const tests = [
    // Authorization header should get AUTH flag
    {
      name: "Authorization",
      location: ParameterLocation.HEADER,
      expected: [ParameterFlag.AUTH]
    },
    
    // Session cookies should get AUTH flag
    {
      name: "session_id",
      location: ParameterLocation.COOKIE,
      expected: [ParameterFlag.AUTH]
    },
    
    // CSRF tokens should get SENSITIVE flag
    {
      name: "csrf_token",
      location: ParameterLocation.COOKIE,
      expected: [ParameterFlag.SENSITIVE]
    },
    
    // File extensions in path should get FILE flag
    {
      name: "document.pdf",
      location: ParameterLocation.PATH,
      expected: [ParameterFlag.FILE]
    }
  ];
  
  for (const test of tests) {
    const flags = assignFlags(
      test.name,
      "test_value",
      ValueType.STRING,
      test.location,
      hoursAgo(48)
    );
    
    for (const expectedFlag of test.expected) {
      if (!flags.includes(expectedFlag)) {
        console.log(`Expected ${expectedFlag} flag for ${test.name} in ${test.location}, got ${flags.join(', ')}`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Test context path handling for JSON parameters
 */
function testContextPath(): boolean {
  // Nested JSON parameter with sensitive context
  const flags = assignFlags(
    "token",
    "secret_value",
    ValueType.STRING,
    ParameterLocation.JSON,
    hoursAgo(48),
    0,
    "user.auth" // context path
  );
  
  // Should get SENSITIVE flag due to context path + name combination
  if (!flags.includes(ParameterFlag.SENSITIVE)) {
    console.log(`Expected SENSITIVE flag for user.auth.token, got ${flags.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Test interesting parameter detection
 */
function testInterestingDetection(): boolean {
  const tests = [
    // Has flags = interesting
    {
      flags: [ParameterFlag.SENSITIVE],
      dynamicConfidence: 0.3,
      valueTypes: [ValueType.STRING],
      expected: true
    },
    
    // High dynamic confidence = interesting
    {
      flags: [],
      dynamicConfidence: 0.8,
      valueTypes: [ValueType.STRING],
      expected: true
    },
    
    // Multiple value types = interesting
    {
      flags: [],
      dynamicConfidence: 0.3,
      valueTypes: [ValueType.STRING, ValueType.INTEGER, ValueType.BOOLEAN],
      expected: true
    },
    
    // High-entropy value types = interesting
    {
      flags: [],
      dynamicConfidence: 0.3,
      valueTypes: [ValueType.JWT],
      expected: true
    },
    
    // Nothing interesting
    {
      flags: [ParameterFlag.NEW], // NEW alone isn't very interesting
      dynamicConfidence: 0.3,
      valueTypes: [ValueType.STRING],
      expected: false
    }
  ];
  
  for (const test of tests) {
    const result = isParameterInteresting(test.flags, test.dynamicConfidence, test.valueTypes);
    if (result !== test.expected) {
      console.log(`Expected interesting=${test.expected}, got ${result}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Test flag prediction without values
 */
function testFlagPrediction(): boolean {
  const predicted = predictFlags("password", ParameterLocation.FORM);
  
  if (!predicted.includes(ParameterFlag.SENSITIVE)) {
    console.log(`Expected SENSITIVE in predicted flags for 'password', got ${predicted.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Run all tests
 */
function runAllTests(): void {
  console.log("🧪 Running Flagger Tests...\n");
  
  // Reset stats before testing
  resetFlagStats();
  
  runTest("Name-based flagging", testNameBasedFlags);
  runTest("Value-based flagging", testValueBasedFlags);  
  runTest("NEW flag (time-based)", testNewFlag);
  runTest("Location-specific flags", testLocationSpecificFlags);
  runTest("Context path handling", testContextPath);
  runTest("Interesting detection", testInterestingDetection);
  runTest("Flag prediction", testFlagPrediction);
  
  console.log("\n📊 Flag Statistics:");
  console.log(getFlagStats());
}

// Export for module usage
export {
  runAllTests,
  testNameBasedFlags,
  testValueBasedFlags,
  testNewFlag,
  testLocationSpecificFlags,
  testContextPath,
  testInterestingDetection,
  testFlagPrediction
};

// Export runner for external usage
export function runTestsIfMain() {
  // This can be called manually when needed
  runAllTests();
}