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
  let invitationToSadiaId = null;
  let invitationToTanvirId = null;
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

    const invSadia = json.invitations?.find(i => i.receiverId === sadiaUserId);
    const invTanvir = json.invitations?.find(i => i.receiverId === tanvirUserId);
    if (invSadia) invitationToSadiaId = invSadia.id;
    if (invTanvir) invitationToTanvirId = invTanvir.id;
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

  // ===========================================================
  // STEP 5 TESTS: CONNECTION REQUESTS & PRIVATE MESSAGING FLOW
  // ===========================================================

  // -----------------------------------------------------------
  // Test 13: View Connection Requests (GET /api/rides/match)
  // -----------------------------------------------------------
  {
    // Sadia checks incoming requests
    const { status, json } = await api("/api/rides/match", { userEmail: "sadia@std.du.ac.bd" });
    assert(status === 200, "Test 13.1: Sadia views connection requests successfully (200 OK)");
    assert(Array.isArray(json.incoming), "Test 13.2: Returns incoming requests array");
    const reqFromFarhana = json.incoming.find(r => r.id === invitationToSadiaId);
    assert(reqFromFarhana !== undefined, "Test 13.3: Farhana's invitation appears in Sadia's incoming list");
    assert(reqFromFarhana?.senderName === "Farhana Rahman", "Test 13.4: Sender is verified student Farhana Rahman");
    assert(reqFromFarhana?.verificationBadge?.includes("Verified"), "Test 13.5: Sender has verified badge");
    assert(reqFromFarhana?.status === "PENDING", "Test 13.6: Invitation status is PENDING");

    // Farhana checks outgoing requests
    const farhanaRes = await api("/api/rides/match", { userEmail: "farhana@std.du.ac.bd" });
    assert(farhanaRes.status === 200, "Test 13.7: Farhana views outgoing connection requests (200 OK)");
    const sentToSadia = farhanaRes.json.outgoing?.find(r => r.id === invitationToSadiaId);
    assert(sentToSadia !== undefined, "Test 13.8: Farhana sees request to Sadia in outgoing list");
  }

  // -----------------------------------------------------------
  // Test 14: Authorization Protection on Invitation Acceptance
  // Only the receiver can accept/reject; sender cannot accept own invitation
  // -----------------------------------------------------------
  {
    const { status, json } = await api(`/api/rides/match/${invitationToSadiaId}`, {
      userEmail: "farhana@std.du.ac.bd", // Farhana is sender, not receiver
      method: "PATCH",
      body: { action: "ACCEPT" },
    });
    assert(status === 403, "Test 14: Sender cannot accept their own invitation (403 Forbidden)", `Status: ${status}`);
  }

  // -----------------------------------------------------------
  // Test 15: Accept Connection Request & Automatically Open Private Conversation
  // (PATCH /api/rides/match/[id])
  // -----------------------------------------------------------
  let activeConversationId = null;
  {
    const { status, json } = await api(`/api/rides/match/${invitationToSadiaId}`, {
      userEmail: "sadia@std.du.ac.bd", // Receiver accepts
      method: "PATCH",
      body: { action: "ACCEPT" },
    });
    assert(status === 200, "Test 15.1: Sadia accepts invitation with 200 OK");
    assert(json.success === true, "Test 15.2: Acceptance response indicates success");
    assert(json.status === "ACCEPTED", "Test 15.3: Status changed to ACCEPTED");
    assert(json.conversationId !== undefined, "Test 15.4: Private conversation created and conversationId returned");
    activeConversationId = json.conversationId;
  }

  // -----------------------------------------------------------
  // Test 16: List Active Conversations (GET /api/rides/conversations)
  // -----------------------------------------------------------
  {
    const { status, json } = await api("/api/rides/conversations", { userEmail: "farhana@std.du.ac.bd" });
    assert(status === 200, "Test 16.1: Farhana lists active conversations (200 OK)");
    assert(json.conversations && json.conversations.length > 0, "Test 16.2: Farhana has at least 1 active conversation");
    const conv = json.conversations.find(c => c.id === activeConversationId);
    assert(conv !== undefined, "Test 16.3: Newly opened conversation with Sadia is listed");
    assert(conv?.partnerName === "Sadia Rahman", "Test 16.4: Conversation partner is Sadia Rahman");
    assert(conv?.partnerBadge?.includes("Verified"), "Test 16.5: Partner badge shows Verified University Student");
  }

  // -----------------------------------------------------------
  // Test 17: Fetch Private Conversation Details & Initial System Message
  // (GET /api/rides/conversations/[id])
  // -----------------------------------------------------------
  {
    const { status, json } = await api(`/api/rides/conversations/${activeConversationId}`, {
      userEmail: "sadia@std.du.ac.bd",
    });
    assert(status === 200, "Test 17.1: Sadia fetches conversation details (200 OK)");
    assert(json.conversation?.partnerName === "Farhana Rahman", "Test 17.2: Partner name is Farhana Rahman");
    assert(json.conversation?.phone === undefined, "Test 17.3: Partner phone number is NOT exposed (privacy protected)");
    assert(json.conversation?.gender === undefined, "Test 17.4: Partner private gender is NOT exposed (privacy protected)");
    assert(json.conversation?.messages && json.conversation.messages.length >= 1, "Test 17.5: Contains initial system connection message");
  }

  // -----------------------------------------------------------
  // Test 18: Send Private Text Message (POST /api/rides/conversations/[id]/messages)
  // -----------------------------------------------------------
  {
    const msgRes = await api(`/api/rides/conversations/${activeConversationId}/messages`, {
      userEmail: "farhana@std.du.ac.bd",
      method: "POST",
      body: {
        text: "Hi Sadia! Let's travel together to campus today.",
        messageType: "TEXT",
      },
    });
    assert(msgRes.status === 200, "Test 18.1: Farhana sends text message successfully (200 OK)");
    assert(msgRes.json.message?.text === "Hi Sadia! Let's travel together to campus today.", "Test 18.2: Message content saved correctly");
    assert(msgRes.json.message?.isSelf === true, "Test 18.3: isSelf is true for sender");
  }

  // -----------------------------------------------------------
  // Test 19: Propose Meeting Location (MEETING_LOCATION type)
  // -----------------------------------------------------------
  {
    const meetRes = await api(`/api/rides/conversations/${activeConversationId}/messages`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: {
        text: "Let's meet at TSC Front Gate at 9:30 AM",
        messageType: "MEETING_LOCATION",
        locationName: "TSC Front Gate",
        locationLat: 23.7317,
        locationLng: 90.3957,
      },
    });
    assert(meetRes.status === 200, "Test 19.1: Sadia proposes meeting spot with 200 OK");
    assert(meetRes.json.message?.messageType === "MEETING_LOCATION", "Test 19.2: Message type is MEETING_LOCATION");
    assert(meetRes.json.message?.locationName === "TSC Front Gate", "Test 19.3: Location name is recorded");
    assert(meetRes.json.message?.locationLat === 23.7317, "Test 19.4: Latitude coordinate saved");
  }

  // -----------------------------------------------------------
  // Test 20: Confirm Intended Meeting Location (PATCH /api/rides/conversations/[id])
  // -----------------------------------------------------------
  {
    const confirmRes = await api(`/api/rides/conversations/${activeConversationId}`, {
      userEmail: "farhana@std.du.ac.bd",
      method: "PATCH",
      body: {
        confirmMeeting: true,
      },
    });
    assert(confirmRes.status === 200, "Test 20.1: Farhana confirms meeting spot with 200 OK");
    assert(confirmRes.json.meetingConfirmed === true, "Test 20.2: meetingConfirmed is now true");
    assert(confirmRes.json.meetingLocation === "TSC Front Gate", "Test 20.3: Confirmed location is TSC Front Gate");
  }

  // -----------------------------------------------------------
  // Test 21: Strict Authorization Guard — Third-Party Cannot Read/Post
  // Tanvir is not a participant in Farhana & Sadia's conversation
  // -----------------------------------------------------------
  {
    // Tanvir attempts to read conversation
    const { status: readStatus } = await api(`/api/rides/conversations/${activeConversationId}`, {
      userEmail: "tanvir@std.du.ac.bd",
    });
    assert(readStatus === 403, "Test 21.1: Unauthorized student blocked from reading conversation (403 Forbidden)");

    // Tanvir attempts to post to conversation
    const { status: postStatus } = await api(`/api/rides/conversations/${activeConversationId}/messages`, {
      userEmail: "tanvir@std.du.ac.bd",
      method: "POST",
      body: { text: "Can I join your chat?" },
    });
    assert(postStatus === 403, "Test 21.2: Unauthorized student blocked from posting in conversation (403 Forbidden)");
  }

  // -----------------------------------------------------------
  // Test 22: Cancel Connection Request by Sender (PATCH /api/rides/match/[id])
  // Farhana cancels the pending invitation sent to Tanvir
  // -----------------------------------------------------------
  {
    const cancelRes = await api(`/api/rides/match/${invitationToTanvirId}`, {
      userEmail: "farhana@std.du.ac.bd",
      method: "PATCH",
      body: { action: "CANCEL" },
    });
    assert(cancelRes.status === 200, "Test 22.1: Sender cancels pending invitation with 200 OK");
    assert(cancelRes.json.status === "CANCELLED", "Test 22.2: Status updated to CANCELLED");
  }

  // ===========================================================
  // STEP 6 TESTS: CONSENT-BASED LIVE GPS TRACKING FOR AGREED JOURNEY
  // ===========================================================

  // -----------------------------------------------------------
  // Test 23: Initial Tracking State Requires Explicit Mutual Consent
  // (GET /api/rides/conversations/[id]/tracking)
  // -----------------------------------------------------------
  {
    const { status, json } = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "farhana@std.du.ac.bd",
    });
    assert(status === 200, "Test 23.1: Farhana retrieves tracking session with 200 OK");
    assert(json.success === true, "Test 23.2: Tracking session returns success: true");
    assert(json.tracking?.bothConsented === false, "Test 23.3: bothConsented is false before explicit agreement");
    assert(json.tracking?.partnerLocation === null, "Test 23.4: partnerLocation is null before consent");
    assert(json.tracking?.connectionStatus === "AWAITING_CONSENT", "Test 23.5: connectionStatus is AWAITING_CONSENT");
    assert(typeof json.tracking?.browserLimitationNotice === "string", "Test 23.6: Browser foreground limitation disclosure is present");
  }

  // -----------------------------------------------------------
  // Test 24: Premature GPS Coordinates Rejected Without Mutual Consent
  // (POST /api/rides/conversations/[id]/tracking/location)
  // -----------------------------------------------------------
  {
    const { status, json } = await api(`/api/rides/conversations/${activeConversationId}/tracking/location`, {
      userEmail: "farhana@std.du.ac.bd",
      method: "POST",
      body: { lat: 23.7317, lng: 90.3957, accuracy: 10 },
    });
    assert(status === 403, "Test 24.1: Submitting GPS without consent rejected with 403 Forbidden");
    assert(json.error && json.error.includes("Consent required"), "Test 24.2: Error explains explicit consent requirement");
  }

  // -----------------------------------------------------------
  // Test 25: Granting Explicit Consent One-by-One
  // (POST /api/rides/conversations/[id]/tracking/consent)
  // -----------------------------------------------------------
  {
    // 25a: Farhana grants consent
    const farhanaRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/consent`, {
      userEmail: "farhana@std.du.ac.bd",
      method: "POST",
      body: { consent: true },
    });
    assert(farhanaRes.status === 200, "Test 25.1: Farhana grants consent with 200 OK");
    assert(farhanaRes.json.bothConsented === false, "Test 25.2: bothConsented remains false awaiting partner");

    // Sadia checks tracking state: sees partner consented, but both not complete
    const sadiaCheck = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "sadia@std.du.ac.bd",
    });
    assert(sadiaCheck.json.tracking?.partnerConsent === true, "Test 25.3: Sadia sees Farhana has consented");
    assert(sadiaCheck.json.tracking?.myConsent === false, "Test 25.4: Sadia has not yet consented");
    assert(sadiaCheck.json.tracking?.partnerLocation === null, "Test 25.5: Location is still hidden");

    // 25b: Sadia grants consent
    const sadiaRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/consent`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: { consent: true },
    });
    assert(sadiaRes.status === 200, "Test 25.6: Sadia grants consent with 200 OK");
    assert(sadiaRes.json.bothConsented === true, "Test 25.7: bothConsented is now TRUE!");
    assert(sadiaRes.json.journeyStatus === "IN_PROGRESS", "Test 25.8: journeyStatus transitioned to IN_PROGRESS");
  }

  // -----------------------------------------------------------
  // Test 26: Push Live Browser GPS Telemetry & Freshness Calculation
  // -----------------------------------------------------------
  {
    // Sadia sends live coordinates (near Dhaka University Curzon Hall)
    const sadiaGpsRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/location`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: {
        lat: 23.7265,
        lng: 90.4012,
        accuracy: 6.5,
        heading: 45.0,
        speed: 1.5,
      },
    });
    assert(sadiaGpsRes.status === 200, "Test 26.1: Sadia uploads GPS telemetry with 200 OK");
    assert(sadiaGpsRes.json.lat === 23.7265, "Test 26.2: Coordinates verified");

    // Farhana sends live coordinates (near TSC)
    const farhanaGpsRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/location`, {
      userEmail: "farhana@std.du.ac.bd",
      method: "POST",
      body: {
        lat: 23.7317,
        lng: 90.3957,
        accuracy: 8.0,
      },
    });
    assert(farhanaGpsRes.status === 200, "Test 26.3: Farhana uploads GPS telemetry with 200 OK");

    // Farhana reads Sadia's live coordinates
    const farhanaView = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "farhana@std.du.ac.bd",
    });
    assert(farhanaView.status === 200, "Test 26.4: Farhana retrieves partner tracking data (200 OK)");
    assert(farhanaView.json.tracking?.partnerLocation !== null, "Test 26.5: Sadia's live location is visible to authorized partner Farhana");
    assert(farhanaView.json.tracking?.partnerLocation?.lat === 23.7265, "Test 26.6: Partner latitude matches");
    assert(farhanaView.json.tracking?.partnerLocation?.lng === 90.4012, "Test 26.7: Partner longitude matches");
    assert(typeof farhanaView.json.tracking?.partnerLocation?.freshnessSeconds === "number", `Test 26.8: Freshness seconds calculated (${farhanaView.json.tracking?.partnerLocation?.freshnessSeconds}s)`);
    assert(farhanaView.json.tracking?.partnerLocation?.isStale === false, "Test 26.9: Location is fresh (isStale: false)");
    assert(farhanaView.json.tracking?.connectionStatus === "LIVE", "Test 26.10: Connection status is LIVE");
  }

  // -----------------------------------------------------------
  // Test 27: Participant Pauses and Resumes Location Sharing
  // (POST /api/rides/conversations/[id]/tracking/stop)
  // -----------------------------------------------------------
  {
    // Sadia temporarily stops sharing
    const pauseRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/stop`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: { action: "STOP_SHARING" },
    });
    assert(pauseRes.status === 200, "Test 27.1: Sadia pauses location sharing with 200 OK");

    // Farhana checks tracking: Sadia's coordinates are masked/null while paused
    const farhanaCheckPaused = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "farhana@std.du.ac.bd",
    });
    assert(farhanaCheckPaused.json.tracking?.partnerLocation === null, "Test 27.2: Partner location masked while paused");
    assert(farhanaCheckPaused.json.tracking?.connectionStatus === "PAUSED", "Test 27.3: Connection status is PAUSED");

    // Sadia resumes sharing
    const resumeRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/stop`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: { action: "RESUME_SHARING" },
    });
    assert(resumeRes.status === 200, "Test 27.4: Sadia resumes location sharing with 200 OK");

    // Send updated location after resume
    await api(`/api/rides/conversations/${activeConversationId}/tracking/location`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: { lat: 23.7270, lng: 90.4005, accuracy: 5.0 },
    });

    const farhanaCheckResumed = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "farhana@std.du.ac.bd",
    });
    assert(farhanaCheckResumed.json.tracking?.partnerLocation?.lat === 23.7270, "Test 27.5: Updated live location visible after resume");
    assert(farhanaCheckResumed.json.tracking?.connectionStatus === "LIVE", "Test 27.6: Connection status returns to LIVE");
  }

  // -----------------------------------------------------------
  // Test 28: Strict Authorization & Privacy Security Guard
  // Third-party student (Tanvir) cannot access or inject live GPS tracking
  // -----------------------------------------------------------
  {
    // Tanvir attempts to read Farhana/Sadia's live coordinates
    const { status: readStatus } = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "tanvir@std.du.ac.bd",
    });
    assert(readStatus === 403, "Test 28.1: Unauthorized student blocked from reading live GPS (403 Forbidden)");

    // Tanvir attempts to send GPS coordinates into this journey
    const { status: postStatus } = await api(`/api/rides/conversations/${activeConversationId}/tracking/location`, {
      userEmail: "tanvir@std.du.ac.bd",
      method: "POST",
      body: { lat: 23.7500, lng: 90.3800 },
    });
    assert(postStatus === 403, "Test 28.2: Unauthorized student blocked from pushing GPS into journey (403 Forbidden)");

    // Unauthenticated request
    const { status: unauthStatus } = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: null,
    });
    assert(unauthStatus === 401, "Test 28.3: Unauthenticated tracking request rejected with 401");
  }

  // -----------------------------------------------------------
  // Test 29: Revoking Consent Immediately Stops Tracking & Clears Coordinates
  // -----------------------------------------------------------
  {
    const revokeRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/consent`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: { consent: false },
    });
    assert(revokeRes.status === 200, "Test 29.1: Consent successfully revoked (200 OK)");

    const farhanaCheckRevoked = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "farhana@std.du.ac.bd",
    });
    assert(farhanaCheckRevoked.json.tracking?.bothConsented === false, "Test 29.2: bothConsented is false after revocation");
    assert(farhanaCheckRevoked.json.tracking?.partnerLocation === null, "Test 29.3: Partner location immediately wiped and hidden");

    // Re-grant consent for final completion test
    await api(`/api/rides/conversations/${activeConversationId}/tracking/consent`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: { consent: true },
    });
  }

  // -----------------------------------------------------------
  // Test 30: End Journey Closes Tracking Session
  // -----------------------------------------------------------
  {
    const endRes = await api(`/api/rides/conversations/${activeConversationId}/tracking/stop`, {
      userEmail: "farhana@std.du.ac.bd",
      method: "POST",
      body: { action: "END_JOURNEY" },
    });
    assert(endRes.status === 200, "Test 30.1: Journey ended successfully with 200 OK");
    assert(endRes.json.action === "END_JOURNEY", "Test 30.2: Action confirmed as END_JOURNEY");

    // Verify journey status is COMPLETED
    const finalCheck = await api(`/api/rides/conversations/${activeConversationId}/tracking`, {
      userEmail: "sadia@std.du.ac.bd",
    });
    assert(finalCheck.json.tracking?.journeyStatus === "COMPLETED", "Test 30.3: journeyStatus is COMPLETED");
    assert(finalCheck.json.tracking?.connectionStatus === "COMPLETED", "Test 30.4: connectionStatus is COMPLETED");
    assert(finalCheck.json.tracking?.partnerLocation === null, "Test 30.5: All location coordinates wiped upon journey completion");

    // Trying to post location after journey ended returns 400 Bad Request
    const postAfterEnd = await api(`/api/rides/conversations/${activeConversationId}/tracking/location`, {
      userEmail: "sadia@std.du.ac.bd",
      method: "POST",
      body: { lat: 23.7317, lng: 90.3957 },
    });
    assert(postAfterEnd.status === 400, "Test 30.6: Location upload rejected after journey ended (400 Bad Request)");
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
