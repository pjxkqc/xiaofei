# FLY-116 Preview smoke

1. Use Preview one-click login as an Organization owner/admin and upload one complete merchant document. Generate, review, and publish its KU so it is `released` and `eligible`.
2. Open `/chatbot`, initialize the Test CA, and verify the Active/Test membership tables identify every KU revision, origin, role, and priority. Platform rows are read-only fallback members; the published merchant KU is a primary member.
3. Enter a question that matches the merchant KU and run the Test CA. Confirm a saved TestTurn ID, actual answer, Test CA ID, and merchant KU revision evidence appear.
4. Submit one correction on that saved answer. Confirm the same question reruns against a new Test CA and the side-by-side cards show distinct source/rerun TestTurn IDs, CA IDs, actual answers, and evidence revision IDs.
5. Activate the Test CA, enable hosting, and send the same question through the ordinary Chatbot. Verify the displayed runtime evidence references the Active CA, never Test.
6. Switch to a second Organization and verify it cannot read or correct the first Organization's test evidence. A no-hit or platform-hit test displays an answer but no correction input.
