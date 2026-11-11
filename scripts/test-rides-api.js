async function runTests() {
  console.log("==================================================");
  console.log("RIDE SHARING REAL-TIME MATCHING & GENDER TESTS");
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
    return { status: res.status, json, headers: res.headers };
  }

  // -----------------------------------------------------------
  // Test 1: Unauthenticated request should return 401
  // -----------------------------------------------------------
  {
    const { status } = await api("/api/rides?destination=TSC&genderPreference=no_preference", { userEmail: null });
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
  // Should match Sadia (female, verified) with privacy-approved info
  // -----------------------------------------------------------
  let sadiaUserId = null;
  let sadiaJourneyId = null;
  {
    const { status, json } = await api(
      "/api/rides?destination=TSC%2C%20University%20of%20Dhaka&origin=Dhanmondi%2027&genderPreference=women_only&destLat=23.7317&destLng=90.3957&originLat=23.7550&originLng=90.3720",
      { userEmail: "farhana@std.du.ac.bd" }
    );
    assert(status === 200, "Test 4.1: Women Only search succeeds with 200 OK");
    assert(json.success === true, "Test 4.2: Response indicates success");
    assert(json.partners && json.partners.length === 1, `Test 4.3: Exactly 1 partner returned (got ${json.partners?.length})`);
    if (json.partners && json.partners.length > 0) {
      const p = json.partners[0];
      sadiaUserId = p.userId;
      sadiaJourneyId = p.id;
      assert(p.fullName === "Sadia Rahman", "Test 4.4: Matched partner is verified female student Sadia Rahman");
      assert(p.verified === true, "Test 4.5: Matched partner has verified: true");
      assert(p.isAvailable === true, "Test 4.6: Partner is available for travel (isAvailable: true)");
      assert(p.gender === undefined, "Test 4.7: Private gender attribute is NOT exposed in response");
      assert(typeof p.approxPickupDistance === "string", `Test 4.8: Approximate pickup distance calculated (${p.approxPickupDistance})`);
      assert(typeof p.destinationCompatibility === "string", `Test 4.9: Destination compatibility calculated (${p.destinationCompatibility})`);
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
  // -----------------------------------------------------------
  let tanvirUserId = null;
  {
    const { status, json } = await api("/api/rides?destination=TSC&genderPreference=men_only", { userEmail: "tanvir@std.du.ac.bd" });
    assert(status === 200, "Test 6.1: Male student Men Only search returns 200 OK");
    const hasSadia = json.partners?.some(p => p.fullName === "Sadia Rahman");
    assert(!hasSadia, "Test 6.2: Sadia (female) is NOT included in Men Only results");
  }

  // -----------------------------------------------------------
  // Test 7: No Preference filter by verified female student (Farhana)
  // Should match both Sadia and Tanvir
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=TSC%2C%20University%20of%20Dhaka&genderPreference=no_preference", { userEmail: "farhana@std.du.ac.bd" });
    assert(status === 200, "Test 7.1: No Preference search returns 200 OK");
    assert(json.partners && json.partners.length === 2, `Test 7.2: Returns both verified companions (got ${json.partners?.length})`);
    const allVerified = json.partners?.every(p => p.verified === true);
    assert(allVerified, "Test 7.3: All matched companions are verified university students");
    const tanvir = json.partners?.find(p => p.fullName === "Tanvir Ahmed");
    if (tanvir) {
      tanvirUserId = tanvir.userId;
    }
  }

  // -----------------------------------------------------------
  // Test 8: Multi-Partner Selection & Invitation (POST /api/rides/match)
  // Farhana selects multiple partners (Sadia and Tanvir)
  // -----------------------------------------------------------
  {
    assert(sadiaUserId !== null && tanvirUserId !== null, "Test 8.0: Identified partner IDs for multi-select test");
    const matchBody = {
      partnerIds: [sadiaUserId, tanvirUserId],
      journeyId: sadiaJourneyId,
      message: "Hey peers, let's coordinate a group commute to TSC DU!",
    };

    const { status, json } = await api("/api/rides/match", {
      userEmail: "farhana@std.du.ac.bd",
      method: "POST",
      body: matchBody,
    });

    assert(status === 200, "Test 8.1: Multi-partner invitation succeeds with 200 OK");
    assert(json.success === true, "Test 8.2: Response indicates success");
    assert(json.count === 2, `Test 8.3: Created invitations for 2 verified partners (got ${json.count})`);
    assert(json.invitations && json.invitations.length === 2, "Test 8.4: Returns 2 invitation records with PENDING status");
  }

  // -----------------------------------------------------------
  // Test 9: Multi-Partner Invitation rejects unverified partners
  // -----------------------------------------------------------
  {
    const matchBody = {
      partnerIds: ["fake_id_123"],
    };

    const { status } = await api("/api/rides/match", {
      userEmail: "farhana@std.du.ac.bd",
      method: "POST",
      body: matchBody,
    });

    assert(status === 404, "Test 9: Invalid / unverified partner IDs rejected with 404 Not Found");
  }

  // -----------------------------------------------------------
  // Test 10: Multi-Partner Invitation rejects unauthenticated request
  // -----------------------------------------------------------
  {
    const matchBody = {
      partnerIds: [sadiaUserId],
    };

    const { status } = await api("/api/rides/match", {
      userEmail: null,
      method: "POST",
      body: matchBody,
    });

    assert(status === 401, "Test 10: Unauthenticated group match request rejected with 401");
  }

  // -----------------------------------------------------------
  // Test 11: Real-Time SSE Stream Endpoint (GET /api/rides/stream)
  // -----------------------------------------------------------
  {
    const res = await fetch("http://localhost:3000/api/rides/stream?destination=TSC&genderPreference=no_preference", {
      headers: { "x-user-email": "farhana@std.du.ac.bd" },
    });

    assert(res.status === 200, "Test 11.1: SSE stream endpoint responds with 200 OK");
    const contentType = res.headers.get("content-type") || "";
    assert(contentType.includes("text/event-stream"), `Test 11.2: Content-Type is text/event-stream (${contentType})`);

    // Read the first chunk from the SSE stream
    const reader = res.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      const chunkText = new TextDecoder().decode(value);
      assert(chunkText.includes("event: connected"), "Test 11.3: SSE stream emits initial 'event: connected'");
      await reader.cancel();
    }
  }

  // -----------------------------------------------------------
  // Test 12: No-results destination returns 0 cleanly
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides?destination=Jahangirnagar%20University%20Savar&genderPreference=no_preference", { userEmail: "farhana@std.du.ac.bd" });
    assert(status === 200, "Test 12.1: No-results destination returns 200 OK");
    assert(json.count === 0 && json.partners?.length === 0, "Test 12.2: Returns 0 results cleanly (empty partners array)");
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
