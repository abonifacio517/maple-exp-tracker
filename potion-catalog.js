'use strict';
// NPC shop prices from MeowDB / NiaDB, MapleStory Classic Consumable Efficiency.
// https://meowdb.com/msclassic/npc-shops/item-efficiency/consumables
// These are listed NPC prices, not player market prices. Unreleased items omitted.
const MAPLE_POTION_CATALOG = Object.freeze({
  hp: Object.freeze([
    ['red-potion','Red Potion',50,100],
    ['orange-potion','Orange Potion',150,250],
    ['white-potion','White Potion',350,500],
    ['apple','Apple',20,40],['egg','Egg',30,60],['fried-chicken','Fried Chicken',60,120],
    ['meat','Meat',80,160],['hot-dog','Hot Dog',180,300],['dried-squid','Dried Squid',180,300],
    ['pizza','Pizza',252,360],['hamburger','Hamburger',350,500],
    ['hot-dog-supreme','Hot Dog Supreme',480,600],['fat-sausage','Fat Sausage',800,800],
    ['unagi','Unagi',1000,1000],['ice-cream-pop','Ice Cream Pop',1500,1500],
    ['cake','Cake (HP + MP)',150,100],['mrs-stew',"Mrs. Ming Ming's Stew (HP + MP)",480,300],
    ['andres-soup',"Andre's Seafood Soup (HP + MP)",480,300],['watermelon','Watermelon (HP + MP)',1920,800],
    ['ribbon-pig-daydream','Ribbon Pig Daydream',500,150],
    ['mushroom-daydream','Orange Mushroom Daydream',500,100]
  ]),
  mp: Object.freeze([
    ['blue-potion','Blue Potion',220,200],['orange-fruit','Orange',50,50],
    ['lemon','Lemon',150,150],['salad','Salad',220,200],
    ['orange-juice','Orange Juice',540,450],['pure-water','Pure Water',1120,800],
    ['grape-juice','Grape Juice',1260,900],['red-bean-sundae','Red Bean Sundae',2250,1500],
    ['cake','Cake (HP + MP)',150,100],['mrs-stew',"Mrs. Ming Ming's Stew (HP + MP)",480,300],
    ['andres-soup',"Andre's Seafood Soup (HP + MP)",480,300],['watermelon','Watermelon (HP + MP)',1920,800]
  ])
});
function potionCatalogEntry(kind,id){return MAPLE_POTION_CATALOG[kind]?.find(row=>row[0]===id)||null;}