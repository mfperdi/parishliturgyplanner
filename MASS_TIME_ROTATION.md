# Mass Time Rotation Feature

## Overview

The assignment logic now automatically **rotates volunteers between their multiple preferred mass times** to provide variety and prevent volunteers from being assigned to the same mass repeatedly.

**Example**: If a volunteer prefers SAT-1700, SUN-0800, and SUN-1000, they'll be rotated between these three times rather than being assigned to SAT-1700 every week.

---

## How It Works

### Tracking System

The system now tracks **two levels of assignment frequency**:

1. **Total Assignments** (overall frequency)
   - Used for general load balancing
   - Volunteers with fewer assignments score higher

2. **Assignments per Event ID** (rotation tracking)
   - NEW! Tracks how many times assigned to each specific mass
   - Used to favor least-used preferred masses

### Scoring Algorithm

**Before Rotation** (old system):
```
Base: 100
- Frequency penalty: -5 per total assignment
+ Mass preference: +20 (if any preferred mass matches)
= Final score
```

**With Rotation** (new system):
```
Base: 100
- Frequency penalty: -5 per total assignment
+ Mass preference: 20 - (3 × times at THIS specific mass)
  - First time at this mass: +20
  - Second time: +17 (-3)
  - Third time: +14 (-6)
  - Fourth time: +11 (-9)
  - Minimum: +5 (never goes below)
= Final score
```

### Example

**Volunteer: Margie Weiner**
- Preferred masses: SAT-1700, SUN-0800, SUN-1000
- Assignment history:
  - SAT-1700: 2 times
  - SUN-0800: 0 times
  - SUN-1000: 1 time

**Scores for next assignment**:
```
SAT-1700: 100 - (3×5) + (20 - 2×3) = 100 - 15 + 14 = 99
SUN-0800: 100 - (3×5) + (20 - 0×3) = 100 - 15 + 20 = 105  ← Winner!
SUN-1000: 100 - (3×5) + (20 - 1×3) = 100 - 15 + 17 = 102
```

**Result**: SUN-0800 wins because it's her least-used preferred mass!

---

## Benefits

### For Volunteers

✅ **Variety**: Experience different mass communities
✅ **Fairness**: All preferred times used, not just one
✅ **Flexibility**: Natural rotation without manual intervention

### For Admins

✅ **Automatic**: No manual tracking needed
✅ **Balanced**: Better distribution across all masses
✅ **Predictable**: Clear algorithm, reproducible results

---

## Configuration

### Current Implementation

**Rotation is ALWAYS ENABLED** with these settings:
- **Rotation penalty**: -3 points per previous assignment to specific mass
- **Minimum bonus**: 5 points (preferred masses always get some bonus)
- **Maximum bonus**: 20 points (first time at a preferred mass)

### Future: Optional Configuration

If you want to make rotation optional or adjust the penalty, you could add to `Config` sheet:

| Setting | Value | Description |
|---------|-------|-------------|
| Enable Mass Time Rotation | TRUE | Turn rotation on/off |
| Rotation Penalty per Assignment | 3 | How much to reduce bonus (-3 is balanced) |
| Minimum Mass Preference Bonus | 5 | Lowest bonus for preferred mass |

(Not implemented yet - contact developer if needed)

---

## Testing

### Run Test Functions

```javascript
// Demonstrates scoring logic with different scenarios
TEST_rotationLogic()

// Analyzes actual rotation patterns in your data
TEST_analyzeRotationPatterns()
```

### Expected Results

After implementing rotation and regenerating assignments, you should see:

**BEFORE** (no rotation):
```
Margie Weiner:
- 1/10: SAT-1700
- 1/24: SAT-1700  ← Same mass again
```

**AFTER** (with rotation):
```
Margie Weiner:
- 1/10: SAT-1700
- 1/24: SUN-0800  ← Different preferred mass
- 2/7:  SUN-1000  ← Another preferred mass
```

---

## Rotation vs Other Factors

The rotation penalty is **moderate** to balance rotation with other priorities:

**Factors that override rotation**:
1. **Family team bonus** (+25) - Serving with family is higher priority
2. **Timeoff blacklist/whitelist** - Availability always respected
3. **Total frequency balancing** - Don't over-assign anyone

**Factors rotation influences**:
1. **Choice between multiple preferred masses** - Favors least-used
2. **Tie-breaking** - When volunteers score similarly, rotation helps decide

### Example Priority

```
Scenario: Assigning SUN-0800 on Jan 17

Candidate A: Margie Weiner
  - SUN-0800 is preferred (served 0 times there)
  - Score: 100 - 15 (frequency) + 20 (first time) = 105

Candidate B: Ming Emperador
  - SUN-0800 is preferred (served 2 times there)
  - Family member already assigned to this mass
  - Score: 100 - 20 (frequency) + 14 (rotation penalty) + 25 (family) = 119

Result: Ming wins (family bonus outweighs rotation)
```

---

## Technical Implementation

### Code Changes

**Files Modified**:
1. `3_assignmentlogic.gs`:
   - `buildAssignmentContext()` - Tracks `byEventId` in assignment counts
   - `updateAssignmentCounts()` - Accepts and tracks Event ID parameter
   - `processAssignments()` - Passes Event ID when updating counts

2. `0b_helper.gs`:
   - `HELPER_calculateVolunteerScore()` - Implements rotation penalty logic

3. `TEST_rotation_logic.gs` (NEW):
   - Test and demonstration functions

### Data Structure

**assignmentCounts Map**:
```javascript
Map {
  volunteerId => {
    total: 5,                  // Total assignments (all masses)
    recent: Date,              // Most recent assignment date
    byEventId: {               // NEW: Per-mass tracking
      "SAT-1700": 2,
      "SUN-0800": 1,
      "SUN-1000": 2
    }
  }
}
```

---

## FAQ

### Q: Will rotation make it harder to fill masses?
**A**: No. The rotation penalty is small (-3 per assignment) compared to other factors. Volunteers still get bonus points for ALL their preferred masses, just slightly reduced if they've served there before.

### Q: What if a volunteer only has one preferred mass?
**A**: Rotation has no effect. They still get the full +20 bonus every time since there's nothing to rotate to.

### Q: Does rotation work across months?
**A**: Yes! Assignment counts include ALL historical assignments (not just current month), so rotation persists across months and years.

### Q: Can I disable rotation?
**A**: Not without code changes currently. The feature is always enabled. If you want to disable it, set the rotation penalty to 0 in the scoring function.

### Q: What if rotation conflicts with my manual assignments?
**A**: Manual assignments update the `byEventId` counts, so rotation will account for them in future auto-assignments. Manual overrides always take precedence.

---

## Troubleshooting

### Issue: Volunteers still getting same mass repeatedly

**Possible causes**:
1. **Only one preferred mass** - Check PreferredMassTime column
2. **Other factors dominating** - Family team bonus or frequency balancing may override
3. **Limited candidate pool** - Not enough volunteers for that mass/role

**Debug**:
```javascript
TEST_analyzeRotationPatterns()  // Shows actual rotation in your data
```

### Issue: Unexpected assignment choices

**Check**:
1. Run `TEST_rotationLogic()` to understand scoring
2. Review volunteer's assignment history (count by Event ID)
3. Check if other bonuses (family, role preference) are affecting score

---

## Best Practices

### For Volunteers

1. **List ALL preferred times** you're willing to serve
   - More preferences = more rotation opportunities
   - One preference = no rotation needed

2. **Update preferences** if your availability changes
   - Rotation respects current preference list
   - Remove old preferred times you can't do anymore

### For Admins

1. **Review rotation patterns** periodically
   ```javascript
   TEST_analyzeRotationPatterns()
   ```

2. **Balance other factors** if rotation seems weak
   - Too many family team assignments reduce rotation
   - Adjust bonuses in scoring function if needed

3. **Communicate to volunteers**
   - Explain they'll rotate between their preferred times
   - Set expectations about variety vs. consistency

---

## Summary

✅ **Implemented**: Mass time rotation is live and automatic
✅ **Balanced**: Works alongside other scheduling priorities
✅ **Tested**: Test functions available to verify behavior
✅ **Documented**: Clear algorithm and examples provided

**Next Steps**:
1. Regenerate a month's assignments to see rotation in action
2. Run `TEST_analyzeRotationPatterns()` to verify
3. Monitor volunteer feedback about variety vs. consistency

---

**Questions or Issues?** Review the test functions in `TEST_rotation_logic.gs` or check execution logs for detailed scoring breakdowns.
