# CareLoop — Sample Documents

These documents are used for testing the extraction pipeline and as demo material during the hackathon presentation.

## Files

### `appointment_letter_sample.txt`
- **Persona**: Priya Sharma, 34, scheduled for arthroscopic knee surgery
- **Use for**: Testing Before-flow (appointment letter schema)
- **Contains**: Date, time, location, fasting instructions, medication holds (blood thinners, metformin, NSAIDs), items to bring, accessibility info, cancellation contact
- **Demo flow**: Upload this first → see checklist, reminders, and suggested questions populate

### `discharge_summary_sample.txt`
- **Persona**: Priya Sharma, post-surgery discharge
- **Use for**: Testing After-flow (discharge summary schema) and check-in generation
- **Contains**: 3 medications (Ibuprofen, Paracetamol, Omeprazole), 5 activity restrictions, wound care, 3 follow-up appointments, 7 explicit warning signs
- **Demo flow**: Upload this second → see action plan and check-in schedule; then use "Simulate Day N" to trigger a check-in

## Stress-testing (add before Day 7)

For demo credibility, also test against at least one "messy" document:
- A low-quality scanned letter (to verify low_confidence_warning fires)
- A document with missing fields (e.g., no appointment date)
- A billing statement (to verify wrong-document-type rejection fires)

## Key warning signs in the discharge summary

These are the exact strings the flagging logic will match against:

1. `"fever above 38°C (100.4°F)"`
2. `"increasing redness, warmth, or swelling around the incision site"`
3. `"discharge or oozing from the wound that is green, yellow, or foul-smelling"`
4. `"severe pain not controlled by the prescribed medications"`
5. `"numbness or pins and needles in the foot or lower leg"`
6. `"significant swelling of the calf (lower leg)"`
7. `"redness or pain that is spreading up or down the leg from the knee"`

To demo a flagged check-in: use "Simulate Day 1" and select a high pain score (4 or 5).
