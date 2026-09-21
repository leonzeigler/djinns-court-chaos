// Case generator for Djinn's Court Chaos.
// Each case is an absurd "crime" for the Plaintiff and Defendant teams to argue over.
// No AI needed here — pure template comedy.

const CHARGES = [
  { charge: "Stealing the last slice of pizza at the family cookout",
    detail: "The defendant claims 'finders keepers.' The plaintiff claims 'I literally paid for the whole pizza.'" },
  { charge: "Farting in a crowded elevator and blaming a child",
    detail: "Security footage is inconclusive. The child has an alibi — he was holding his nose before it happened." },
  { charge: "Eating someone's clearly-labeled leftovers from the work fridge",
    detail: "The container said 'DO NOT TOUCH' in three languages. The defendant says hunger is a universal language." },
  { charge: "Spoiling the ending of a show everyone else is still watching",
    detail: "The defendant posted it in the group chat at 2 AM. The plaintiff was only on episode 3." },
  { charge: "Taking 45 minutes in the only bathroom before a road trip",
    detail: "The plaintiff's bladder has filed a separate complaint. The defendant claims 'self-care is not a crime.'" },
  { charge: "Reheating fish in the office microwave",
    detail: "Three coworkers evacuated. The break room still smells like low tide. The defendant calls it 'meal prep.'" },
  { charge: "Backing into a parking spot way too slowly while everyone waits",
    detail: "Seven cars honked. One driver aged visibly. The defendant was 'just being careful.'" },
  { charge: "Talking through the entire movie at the theater",
    detail: "The plaintiff missed every plot twist. The defendant insists they were 'adding commentary.'" },
  { charge: "Using the last of the toilet paper and not replacing the roll",
    detail: "A cardboard tube was left as evidence. The defendant's fingerprints are all over this one." },
  { charge: "Leaving one sip of juice in the carton and putting it back",
    detail: "Forensics confirm: one (1) sip remained. The defendant calls it 'being considerate of the next person.'" },
  { charge: "Falling asleep on the couch during game night and snoring through the finals",
    detail: "The snoring was recorded at 82 decibels. The defendant claims they were 'resting their eyes strategically.'" },
  { charge: "Double-dipping the chip at the party",
    detail: "Witnesses counted three dips, one chip. The defendant argues the dip 'was basically theirs anyway.'" },
  { charge: "Sending a risky text to the wrong group chat",
    detail: "The message was meant for one person. It reached 47. Screenshots are now exhibits A through Z." },
  { charge: "Wearing socks with sandals to a wedding",
    detail: "The photographer has refused to release the photos. The defendant calls it 'comfort over convention.'" },
  { charge: "Clipping toenails in the living room",
    detail: "A toenail was recovered from the couch cushions. The defendant shows no remorse." },
  { charge: "Starting the group project the night before it's due",
    detail: "The plaintiff did 90% of the work. The defendant contributed a title slide and 'moral support.'" },
  { charge: "Blasting music at 6 AM on a Saturday",
    detail: "The whole street woke up. The defendant was 'just feeling the vibe.' The vibe is now a co-defendant." },
  { charge: "Borrowing the car and returning it on empty",
    detail: "The tank was bone dry. The defendant left an air freshener as compensation. The court is unimpressed." },
  { charge: "Licking the spoon and putting it back in the dip",
    detail: "Lab tests confirm saliva. The defendant claims 'taste-testing is a public service.'" },
  { charge: "Reading someone's texts over their shoulder",
    detail: "The defendant memorized the whole conversation. The plaintiff wants those memories subpoenaed." },
  { charge: "Hogging the aux cord and playing only their own playlist",
    detail: "Four hours. One genre. Zero skips allowed. The passengers have formed a support group." },
  { charge: "Finishing the ice cream and putting the empty carton back in the freezer",
    detail: "The plaintiff's scream was heard three houses away. The defendant calls it 'an innocent mistake.'" },
  { charge: "Leaving the shopping cart in the middle of the parking lot",
    detail: "It rolled into a BMW. The defendant was 'in a hurry.' Justice is never in a hurry." },
  { charge: "Snoring so loud the neighbors filed a noise complaint",
    detail: "Two noise complaints. One concerned citizen. The defendant's snore has its own zip code now." },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeCase() {
  const c = pick(CHARGES);
  return {
    title: "Case #" + (1000 + Math.floor(Math.random() * 9000)),
    charge: c.charge,
    detail: c.detail,
  };
}

module.exports = { makeCase };
