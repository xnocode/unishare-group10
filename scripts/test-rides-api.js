async function runTests() {
  console.log("==================================================");
  console.log("RIDE SHARING BACKEND FILTERING & VALIDATION TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = "") {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${extraInfo}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extraInfo}`);
      failed++;
    }
  }

  const BASE_URL = "http://localhost:3000";

  // Helper for HTTP requests
  async function api(path, { userEmail = "farhana@std.du.ac.bd", method = "GET", body = null } = {}) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (userEmail) {
      headers["x-user-email"] = userEmail;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  // -----------------------------------------------------------
  // Test 1: Unauthenticated request should return 401
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=TSC&genderPreference=no_preference", { userEmail: null });
    assert(status === 401, "Test 1: Unauthenticated search rejected with 401 Unauthorized", `Status: ${status}`);
  }

  // -----------------------------------------------------------
  // Test 2: Missing destination should return 400
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?genderPreference=no_preference");
    assert(status === 400 && json.error && json.error.includes("destination"), "Test 2: Missing destination rejected with 400 Bad Request", `Error: ${json.error}`);
  }

  // -----------------------------------------------------------
  // Test 3: Invalid gender preference should return 400
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=TSC&genderPreference=alien_mode");
    assert(status === 400 && json.error && json.error.includes("gender preference"), "Test 3: Invalid gender preference rejected with 400 Bad Request", `Error: ${json.error}`);
  }

  // -----------------------------------------------------------
  // Test 4: Women Only filter by verified female student (Farhana)
  // Should match Sadia (female, verified) but NOT Tanvir (male) and NOT unverified user
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=TSC%2C%20University%20of%20Dhaka&genderPreference=women_only", { userEmail: "farhana@std.du.ac.bd" });
    assert(status === 200, "Test 4.1: Women Only search succeeds with 200 OK");
    assert(json.success === true, "Test 4.2: Response indicates success");
    assert(json.partners && json.partners.length === 1, `Test 4.3: Exactly 1 partner returned (got ${json.partners?.length})`);
    if (json.partners && json.partners.length > 0) {
      assert(json.partners[0].fullName === "Sadia Rahman", "Test 4.4: Matched partner is verified female student Sadia Rahman");
      assert(json.partners[0].verified === true, "Test 4.5: Matched partner has verified: true");
      assert(json.partners[0].gender === undefined, "Test 4.6: Private gender attribute is NOT exposed in response");
    }
  }

  // -----------------------------------------------------------
  // Test 5: Female student searching Men Only should trigger Safety 403 Forbidden
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=TSC&genderPreference=men_only", { userEmail: "farhana@std.du.ac.bd" });
    assert(status === 403 && json.error && json.error.includes("Safety Policy"), "Test 5: Female student searching Men Only rejected with 403 Safety Policy", `Error: ${json.error}`);
  }

  // -----------------------------------------------------------
  // Test 6: Male student (Tanvir) searching Men Only
  // Should NOT return Sadia (female)
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=TSC&genderPreference=men_only", { userEmail: "tanvir@std.du.ac.bd" });
    assert(status === 200, "Test 6.1: Male student Men Only search returns 200 OK");
    const hasSadia = json.partners?.some(p => p.fullName === "Sadia Rahman");
    assert(!hasSadia, "Test 6.2: Sadia (female) is NOT included in Men Only results");
  }

  // -----------------------------------------------------------
  // Test 7: No Preference filter by verified female student (Farhana)
  // Should match Sadia (female companion) and Tanvir (male companion accepting all)
  // Must NOT include unverified user
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=TSC%2C%20University%20of%20Dhaka&genderPreference=no_preference", { userEmail: "farhana@std.du.ac.bd" });
    assert(status === 200, "Test 7.1: No Preference search returns 200 OK");
    assert(json.partners && json.partners.length === 2, `Test 7.2: Returns both verified companions (got ${json.partners?.length})`);
    const allVerified = json.partners?.every(p => p.verified === true);
    assert(allVerified, "Test 7.3: All matched companions are verified university students");
    const hasUnverified = json.partners?.some(p => p.fullName === "Notehub C" || p.verified === false);
    assert(!hasUnverified, "Test 7.4: Unverified students are strictly excluded by backend");
  }

  // -----------------------------------------------------------
  // Test 8: Destination with no active journeys (No-results test)
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=Jahangirnagar%20University%20Savar&genderPreference=no_preference", { userEmail: "farhana@std.du.ac.bd" });
    assert(status === 200, "Test 8.1: No-results destination returns 200 OK");
    assert(json.count === 0 && json.partners?.length === 0, "Test 8.2: Returns 0 results cleanly (empty partners array)");
  }

  // -----------------------------------------------------------
  // Test 9: Register Journey (POST /api/rides) with zero driver/seat fields
  // -----------------------------------------------------------
  {
    const postBody = {
      origin: "Dhanmondi 27, Dhaka",
      destination: "TSC, University of Dhaka",
      genderPreference: "women_only",
      notes: "Looking for a campus buddy to walk/share commute to Arts faculty.",
    };
    const { status, json } = await api("/api/rides", { userEmail: "farhana@std.du.ac.bd", method: "POST", body: postBody });
    assert(status === 201, "Test 9.1: Register journey succeeds with 201 Created");
    assert(json.success === true, "Test 9.2: Successfully created travel journey");
    assert(json.journey && json.journey.genderPreference === "women_only", "Test 9.3: Preserves women_only preference");
  }

  // -----------------------------------------------------------
  // Test 10: Register Journey with unverified user should be rejected
  // -----------------------------------------------------------
  {
    const postBody = {
      origin: "Dhanmondi 27, Dhaka",
      destination: "TSC, University of Dhaka",
      genderPreference: "no_preference",
    };
    const { status, json } = await api("/api/rides", { userEmail: "notehub3c2@gmail.com", method: "POST", body: postBody });
    assert(status === 403 && json.error && json.error.includes("Verification Required"), "Test 10: Unverified user cannot post journey (403 Forbidden)", `Error: ${json.error}`);
  }

  console.log("==================================================");
  console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
