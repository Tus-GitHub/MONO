export const STICKERS = [
  { id: "love", emoji: "🥰", label: "Love you", background: "bg-primary-tint" },
  { id: "hug", emoji: "🫂", label: "A big hug", background: "bg-accent-tint" },
  { id: "kiss", emoji: "😘", label: "A little kiss", background: "bg-primary-tint" },
  { id: "miss", emoji: "🥺", label: "Miss you", background: "bg-warning-tint" },
  { id: "date", emoji: "🍿", label: "Date night?", background: "bg-accent-tint" },
  { id: "coffee", emoji: "☕", label: "Coffee together?", background: "bg-warning-tint" },
  { id: "proud", emoji: "🌟", label: "Proud of you", background: "bg-warning-tint" },
  { id: "sleep", emoji: "🌙", label: "Sweet dreams", background: "bg-accent-tint" },
] as const;
export const EMOJI = ["❤️", "🥰", "😂", "😘", "🥺", "🫂", "😍", "🎉", "🌹", "✨", "👍", "💕"];
export const EMOJI_OPTIONS = [
  ["❤️", "love heart"], ["🥰", "love smile happy"], ["😂", "laugh tears funny"], ["😘", "kiss love"],
  ["🥺", "please miss you"], ["🫂", "hug comfort"], ["😍", "love heart eyes"], ["🎉", "celebrate party"],
  ["🌹", "rose flower"], ["✨", "sparkles magic"], ["👍", "yes thumbs up"], ["💕", "two hearts love"],
  ["😊", "smile happy"], ["🤗", "hug smile"], ["😎", "cool sunglasses"], ["🙈", "shy monkey"],
  ["😴", "sleep good night"], ["😭", "cry sad"], ["😅", "nervous laugh"], ["🤭", "giggle shy"],
  ["😋", "yummy food"], ["🤩", "excited star eyes"], ["💋", "kiss lips"], ["💌", "love letter"],
  ["💖", "sparkling heart"], ["💐", "flowers bouquet"], ["🌻", "sunflower sunshine"], ["🌙", "moon night"],
  ["☀️", "sun morning"], ["⭐", "star proud"], ["🔥", "fire hot"], ["💯", "hundred perfect"],
  ["🙏", "please thank you"], ["🤞", "luck fingers crossed"], ["🤝", "together handshake"], ["🫶", "heart hands love"],
  ["☕", "coffee cafe"], ["🍿", "popcorn movie"], ["🍕", "pizza food"], ["🍰", "cake dessert"],
  ["🥂", "cheers date"], ["🎵", "music song"], ["🎮", "game play"], ["✈️", "travel trip"],
  ["🏠", "home together"], ["🐱", "cat pet"], ["🐶", "dog pet"], ["🧸", "teddy bear hug"],
] as const;
export const CHAT_IMAGE_LIMIT = 512 * 1024;
