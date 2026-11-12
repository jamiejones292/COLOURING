export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'kids', name: 'Kids & Friends', emoji: '🧒', color: '#ff7a1a' },
  { id: 'dinosaurs', name: 'Dinosaurs', emoji: '🦕', color: '#1fc995' },
  { id: 'animals', name: 'Animals', emoji: '🐶', color: '#ffbf1f' },
  { id: 'flowers', name: 'Flowers & Gardens', emoji: '🌻', color: '#5fcf3a' },
  { id: 'party', name: 'Balloons & Parties', emoji: '🎈', color: '#ff4797' },
  { id: 'space', name: 'Space', emoji: '🚀', color: '#7c5cff' },
  { id: 'rainy', name: 'Rainy Days', emoji: '☔', color: '#1ea7f5' },
  { id: 'treats', name: 'Yummy Treats', emoji: '🧁', color: '#e879a6' },
  { id: 'silly', name: 'Silly Friends', emoji: '👾', color: '#a855f7' },
  { id: 'angels', name: 'Angels', emoji: '👼', color: '#f59ec4' },
  { id: 'christmas', name: 'Christmas Elves', emoji: '🎄', color: '#16a34a' },
];

export interface ColoringPage {
  id: string;
  title: string;
  category: string;
  /** vector line art (optional — not used by the current library) */
  svg?: string;
  /** URL of a black-on-white line-art image */
  image?: string;
  /** small preview image for the gallery */
  thumb?: string;
  /** "Leak guard" (gap closing, in px) that suits this page */
  gap?: number;
}

// Line-art images live in ./pictures (full size) and ./pictures/thumbs (gallery previews).
const pictureUrls = import.meta.glob('./pictures/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const thumbUrls = import.meta.glob('./pictures/thumbs/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function picture(id: string, title: string, category: string, gap = 1): ColoringPage {
  return { id, title, category, image: pictureUrls[`./pictures/${id}.png`], thumb: thumbUrls[`./pictures/thumbs/${id}.png`], gap };
}

export const PAGES: ColoringPage[] = [
  // ---- colouring book (100 pages)
  picture('balloon-boy', 'Balloon Boy', 'party', 2),
  picture('planting-flowers', 'Planting Flowers', 'flowers', 2),
  picture('rainy-day-friends', 'Rainy Day Friends', 'rainy', 2),
  picture('off-to-school', 'Off to School', 'kids', 2),
  picture('girl-in-the-garden', 'Girl in the Garden', 'flowers', 2),
  picture('little-gardener', 'Little Gardener', 'flowers', 2),
  picture('happy-dino', 'Happy Dino', 'dinosaurs', 5),
  picture('balloon-parade', 'Balloon Parade', 'party', 2),
  picture('penguin-pal', 'Penguin Pal', 'animals', 2),
  picture('floating-away', 'Floating Away', 'party', 2),
  picture('dino-bouquet', 'Dino Bouquet', 'dinosaurs', 2),
  picture('spotty-dino', 'Spotty Dino', 'dinosaurs', 2),
  picture('umbrella-girl', 'Umbrella Girl', 'rainy', 2),
  picture('busy-boy', 'Busy Boy', 'kids', 2),
  picture('up-up-and-away', 'Up, Up and Away', 'party', 2),
  picture('rocket-rider', 'Rocket Rider', 'space', 2),
  picture('dino-in-the-park', 'Dino in the Park', 'dinosaurs', 4),
  picture('jumping-for-joy', 'Jumping for Joy', 'kids', 2),
  picture('elephant-flowers', 'Elephant & Flowers', 'animals', 2),
  picture('little-astronaut', 'Little Astronaut', 'space', 2),
  picture('smiley-dino', 'Smiley Dino', 'dinosaurs', 2),
  picture('leafy-friend', 'Leafy Friend', 'silly', 2),
  picture('school-friends', 'School Friends', 'kids', 2),
  picture('rainy-day-boy', 'Rainy Day Boy', 'rainy', 2),
  picture('potted-pal', 'Potted Pal', 'silly', 2),
  picture('market-day', 'Market Day', 'kids', 2),
  picture('space-explorer', 'Space Explorer', 'space', 2),
  picture('dragon-dino', 'Dragon Dino', 'dinosaurs', 2),
  picture('flower-princess', 'Flower Princess', 'kids', 2),
  picture('flowers-for-you', 'Flowers for You', 'kids', 2),
  picture('balloon-ride', 'Balloon Ride', 'party', 2),
  picture('sunny-sunflower', 'Sunny Sunflower', 'flowers', 2),
  picture('bubble-dino', 'Bubble Dino', 'dinosaurs', 3),
  picture('sunflower-kid', 'Sunflower Kid', 'flowers', 2),
  picture('balloon-buddy', 'Balloon Buddy', 'silly', 2),
  picture('firefighter', 'Firefighter', 'kids', 2),
  picture('wise-owl', 'Wise Owl', 'animals', 2),
  picture('starry-night', 'Starry Night', 'space', 3),
  picture('little-scientist', 'Little Scientist', 'kids', 2),
  picture('googly-monster', 'Googly Monster', 'silly', 2),
  picture('flower-pots', 'Flower Pots', 'flowers', 3),
  picture('umbrella-buddies', 'Umbrella Buddies', 'rainy', 2),
  picture('baby-dragon', 'Baby Dragon', 'dinosaurs', 2),
  picture('owl-in-the-tree', 'Owl in the Tree', 'animals', 2),
  picture('garden-girl', 'Garden Girl', 'kids', 2),
  picture('cloudy-day', 'Cloudy Day', 'kids', 2),
  picture('smiling-flower', 'Smiling Flower', 'flowers', 4),
  picture('elephant-family', 'Elephant Family', 'animals', 2),
  picture('dino-bubbles', 'Dino & Bubbles', 'dinosaurs', 2),
  picture('sunny-boy', 'Sunny Boy', 'kids', 2),
  picture('fruity-friend', 'Fruity Friend', 'treats', 2),
  picture('three-friends', 'Three Friends', 'rainy', 2),
  picture('ice-cream-dino', 'Ice Cream Dino', 'dinosaurs', 2),
  picture('umbrella-dino', 'Umbrella Dino', 'dinosaurs', 2),
  picture('bubble-buddy', 'Bubble Buddy', 'silly', 2),
  picture('party-girl', 'Party Girl', 'party', 2),
  picture('flower-boy', 'Flower Boy', 'flowers', 2),
  picture('adventure-boy', 'Adventure Boy', 'kids', 2),
  picture('spacewalk', 'Spacewalk', 'space', 2),
  picture('astronaut-kid', 'Astronaut Kid', 'space', 2),
  picture('owl-in-bloom', 'Owl in Bloom', 'animals', 2),
  picture('little-princess', 'Little Princess', 'kids', 2),
  picture('cupcake-cutie', 'Cupcake Cutie', 'treats', 2),
  picture('birthday-cake', 'Birthday Cake', 'treats', 2),
  picture('watering-the-garden', 'Watering the Garden', 'flowers', 2),
  picture('bunch-of-flowers', 'Bunch of Flowers', 'flowers', 2),
  picture('happy-sunflower', 'Happy Sunflower', 'flowers', 2),
  picture('city-runner', 'City Runner', 'kids', 3),
  picture('flower-fun', 'Flower Fun', 'kids', 2),
  picture('fluffy-sheep', 'Fluffy Sheep', 'animals', 2),
  picture('village-run', 'Village Run', 'kids', 2),
  picture('flower-cupcake', 'Flower Cupcake', 'treats', 2),
  picture('super-balloon', 'Super Balloon', 'party', 2),
  picture('night-owl', 'Night Owl', 'animals', 2),
  picture('froggy', 'Froggy', 'animals', 3),
  picture('flower-friend', 'Flower Friend', 'flowers', 2),
  picture('cheeky-dino', 'Cheeky Dino', 'dinosaurs', 2),
  picture('duck-bath', 'Duck Bath', 'animals', 2),
  picture('rooster', 'Rooster', 'animals', 2),
  picture('rainy-dino', 'Rainy Dino', 'dinosaurs', 2),
  picture('party-bear', 'Party Bear', 'party', 2),
  picture('balloon-friends', 'Balloon Friends', 'party', 2),
  picture('jungle-dino', 'Jungle Dino', 'dinosaurs', 2),
  picture('starry-balloons', 'Starry Balloons', 'party', 2),
  picture('busy-gardener', 'Busy Gardener', 'flowers', 2),
  picture('flying-hero', 'Flying Hero', 'kids', 2),
  picture('dino-picnic', 'Dino Picnic', 'dinosaurs', 2),
  picture('snack-time-dino', 'Snack Time Dino', 'dinosaurs', 2),
  picture('potted-sunflower', 'Potted Sunflower', 'flowers', 2),
  picture('turtle-shelter', 'Turtle Shelter', 'animals', 2),
  picture('star-buddy', 'Star Buddy', 'silly', 2),
  picture('popcorn-party', 'Popcorn Party', 'party', 2),
  picture('star-explorer', 'Star Explorer', 'kids', 3),
  picture('fire-chief', 'Fire Chief', 'kids', 2),
  picture('hot-air-balloon', 'Hot Air Balloon', 'party', 2),
  picture('dancing-flower', 'Dancing Flower', 'flowers', 3),
  picture('umbrella-day', 'Umbrella Day', 'rainy', 2),
  picture('dessert-dino', 'Dessert Dino', 'dinosaurs', 2),
  picture('superhero', 'Superhero', 'kids', 2),
  picture('dino-explorer', 'Dino Explorer', 'dinosaurs', 2),
  // ---- extra pictures
  picture('puppy-sunny', 'Sunny Puppy', 'animals'),
  picture('puppy-puddle', 'Puddle Puppy', 'animals'),
  picture('puppy-party', 'Party Puppy', 'animals'),
  picture('puppy-flowers', 'Puppy in the Flowers', 'animals'),
  picture('puppy-ball', 'Puppy & Ball', 'animals'),
  picture('elephant-baby', 'Baby Elephant', 'animals'),
  picture('elephant-walk', 'Happy Elephant', 'animals'),
  picture('elephant-sunny', 'Sunny Elephant', 'animals'),
  picture('elephant-flower', 'Elephant & Flower', 'animals'),
  picture('angel-clouds', 'Angel in the Clouds', 'angels'),
  picture('angel-heart', 'Angel with a Heart', 'angels'),
  picture('angel-kneeling', 'Little Angel', 'angels'),
  picture('angel-peaceful', 'Peaceful Angel', 'angels'),
  picture('elf-waving', 'Waving Elf', 'christmas'),
  picture('elf-stocking', 'Elf & Stocking', 'christmas'),
  picture('elf-snowflakes', 'Elf & Snowflakes', 'christmas'),
  picture('elf-tree', 'Elf & Christmas Tree', 'christmas'),
];

export const getPage = (id: string) => PAGES.find((p) => p.id === id);
export const getCategory = (id: string) => CATEGORIES.find((c) => c.id === id);
