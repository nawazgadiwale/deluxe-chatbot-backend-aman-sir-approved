const cron = require("node-cron")
const { managerSyncDailyQuotesOfDDA, managerSyncDailyQuotesStationery } = require("../services/managerServices")
const Data = require("../models/Data")

const productMap = {
    'Standard Pack - Business Cards': 1100,
    'Bristol Pack - Business Cards': 1101,
    'Executive Business Cards': 1102,
    'Pearl White Business Cards': 1103,
    'PVC Plastic Business Cards': 1104,
    'Kraft Business Cards': 1105,
    'Classic - Conqueror Business Cards': 1106,
    'Classic Ice-gold Business Cards': 1107,
    'Velvet Business Cards': 1108,
    'Textured Business Cards': 1109,
    'Translucent Business Cards': 1110,
    '3d Spot Uv Business Cards': 1111,
    '3d Foil Business Cards': 1112,
    '3d Spot UV & 3D Foil Business Cards': 1113,
    'Letterheads': 1114,
    'Envelopes (Readymade)': 1115,
    'Customised Envelopes': 1116,
    'Folders': 1117,
    'Notepads': 1118,
    'Custom Notebooks': 1119,
    'Thank You Cards': 1120,
    'Certificates': 1121,
    'Self Ink Stamp': 1122,
    'Wax Seal': 1123,
    'Embossing Seal': 1124,
    'NCR Books': 1125,
    'Flyers': 1126,
    'Bifold / Trifold Flyer': 1127,
    'Booklets (Digital)': 1128,
    'Booklets (Offset)': 1129,
    'ID Cards': 1130,
    'CD or DVD Printing': 1131,
    'Hang Tags': 1132,
    'Compliment Slips': 1133,
    'Tickets & Coupons': 1134,
    'Scratch & Win Cards': 1135,
    'Tent Cards': 1136,
    'Stickers - KM': 1137,
    'Stickers - Roland': 1138,
    'Stickers - Offset': 1139,
    'Transparent Stickers': 1140,
    'Epoxy Stickers': 1141,
    'Foil Stickers': 1142,
    'Metal Stickers': 1143,
    'Hologram Stickers': 1144,
    'Kraft Paper Stickers': 1145,
    'Business Cards - Offset': 1146,
    'Paper Bags - Offset': 1147,
    'Kraft Paper Bags': 1148,
    'Sales Offset': 1149,
    'Desk Calender': 1150,
    'Door Hanger': 1151,
    'Car Matt': 1152,
    'Business cards – Thick Cards': 1153,
    'ID Badges': 1154,
    'Toothpick Flags': 1155,

    'Paper Napkin': 7000,
    'PENS - TWIST': 7001,
    'Pens - Metal': 7002,
    'Pens - Recycled': 7003,
    'PU Notebooks': 7004,
    'Mouse pads': 7005,
    'Round neck T-shirts': 7006,
    'Polo neck T-shirts': 7007,
    'Round neck Jersey': 7008,
    'Jersey with Collar': 7009,
    'Jersey V Neck': 7010,
    'Solid Cap': 7011,
    'Silicon Wristbands': 7012,
    'Fabric Wristbands': 7013,
    'Tyvek Wristbands': 7014,
    'Vinyl Wristbands': 7015,
    'Button Badges': 7016,
    'Lanyard (Readymade)': 7017,
    'Lanyard (Customized)': 7018,
    'PVC ID CARDS': 7019,
    'Keychain': 7020,
    'Twister USB': 7021,
    'OTG Metal Micro USB': 7022,
    'Corporate Card USB': 7023,
    'Mugs': 7024,
    'VMUGS': 7025,
    'Cotton Bags (Readymade)': 7026,
    'Keychain (Elegant )': 7027,
    'Pen with stylus': 7028,
    'Tumbler': 7029,
    'Tumbler – Forest': 7030,
    'Paper Bags': 7031,
    'Non-Woven Bag': 7032,
    'Jute Bags': 7033,
    'Tote Bags': 7034,
    'String Bags': 7035,
    'Water bottle branding': 7036,
    'Plastic pen - SW': 7037,
    'Chrome Engraving': 7038,
    'Pen - Gloss finish': 7039,
    'Pen - Burgundy Finish & Chrome finish': 7040,
    'Epoxy Badge': 7041,
    'Lapel Pin': 7042,
    'Ppaper Cups': 7043,
    'Safety Vest': 7044,
    'Embroidery Patches': 7045,
    'Reel Badges': 7046,
    'Card Holders': 7047,
    'Neck Ties': 7048,
    'Car Sunshades': 7049,
    'Bottles': 7050,
    'Coasters': 7051,
    'Balloons': 7052,
    'Diary': 7053,
    'Hand Fan': 7054,
    'Stres Ball': 7055,
    'Power banks': 7056,
    'Trophy': 7057,
    'Ribbon': 7058,
    'Charging Cable': 7059,
    'Backpack': 7060,
    'Woven Label': 7061,
    'Gift Sets': 7062,
    'Mint Box': 7063,
    'Silicone Fridge Magnet': 7064,

    'PVC White Sticker Print & Cut (CMYK)': 1001,
    'PVC White Sticker Print & Cut (CMYK+Varnish)': 1002,
    'PVC Clear Sticker Print & Cut (CMYK)': 1003,
    'PVC Clear Sticker Print & Cut (White)': 1004,
    'PVC Clear Sticker Print & Cut (CMYK+White)': 1005,
    'PVC Clear Sticker Print & Cut (CMYK+White+Spot UV)': 1006,
    'PVC Ultra Clear Sticker Print & Cut (CMYK)': 1007,
    'PVC Ultra Clear Sticker Print & Cut (White)': 1008,
    'PVC Ultra Clear Sticker Print & Cut (CMYK+White)': 1009,
    'PVC Ultra Clear Sticker Print & Cut (CMYK+White+Spot UV)': 1010,
    'PVC Color Sticker Print & Cut (White)': 1011,
    'PVC Color Sticker Print & Cut (Spot UV)': 1012,
    'PVC Color Sticker Print & Cut (White+Spot UV)': 1013,
    'PVC Foil Sticker Print & Cut (White / Black)': 1014,
    'PVC Foil Sticker Print & Cut (White+Spot UV)': 1015,
    'Hologram Sticker Print & Cut (CMYK)': 1016,
    'Hologram Sticker Print & Cut (White)': 1017,
    'Hologram Sticker Print & Cut (CMYK+White)': 1018,
    'Hologram Sticker Print & Cut (CMYK+SpotUV)': 1019,
    'Wind Shield Sticker (1Sided)': 1020,
    'Wind Shield Sticker (2 Sided)': 1021,
    'Metallic Silver Sticker Print & Cut (Thin)': 1022,
    'Metallic Silver Sticker Print & Cut (Thick)': 1023,
    'DTF UV Sticker (CMYK)': 1024,
    'DTF UV Sticker (Gold - Silver)': 1025,
    'Hologram Sticker P&C (Security CMYKWV)': 1026,
    'Epoxy Sticker': 1027,

    'ID Cards & Badge Reel': 1130,

    'Head Scarf': 2000,
    'Neck Scarf': 2001,
    'Napkin Fabric': 2002,
    'Sash': 2003,
    'Sash Graduation': 2004,
    'Textile Roll': 2005,
    'Textile Cut Piece': 2006,
    'Bandana': 2007,
    'Sheilla': 2008,
    'Abaya': 2009,
    'Bag Scarf': 2010,
    'Sarong': 2012,
    'Beach Shorts': 2013,
    'Pocket Handkerchief': 2014,
    'Blade Flag Medium': 2015,
    'Scrunchie': 2016,
    'Telescopic Flags': 2017,
    'Advertising Flags': 2018,
    'Fabric Backdrop Seamless Indoor (2.3 x 2.3)': 2019,
    'Fabric Backdrop Seamless Indoor(3 x 2.3)': 2020,
    'Bean Bags': 2021,
    'Fabric Backdrop Seamless indoor (5 x 2.3)': 2022,
    'Fabric Backdrop Seamless Indoor(6 x 2.3)': 2023,
    'Drawstring Pouches': 2024,
    'Fabric Backdrop Seamless Outdoor (3 x 2.3)': 2025,
    'Fabric Backdrop Seamless Outdoor (4 x 2.3)': 2026,
    'Fabric Backdrop Seamless Outdoor (5 x 2.3)': 2027,
    'Fabric Backdrop Seamless Outdoor (6 x 2.3)': 2028,
    'Parasol Umbrella': 2029,
    'Woven Labels': 2030,
    'Cushion': 2031,
    'Cushion cover': 2032,
    'Floor Cushion': 2033,
    'Tiny Cushion': 2034,
    'Fabric Backdrop Seamless Indoor(4 x 2.3)': 2035,
    'Blanket': 2036,
    'Fabric Wrap': 2037,
    'Fabric Backdrop Seamless Outdoor (2.3 x 2.3)': 2038,
    'Arm band': 2039,
    'Hand Umbrella': 2040,
    'Face mask': 2041,
    'Apron': 2042,

    'REVERSE CUT FROSTED STICKER (Die Cut)': 3001,
    'STANDARD CUT FROSTED STICKER (Die Cut)': 3002,
    'PRINTED FROSTED STICKER (ECO)': 3003,
    'PRINTED FROSTED STICKER (UV-MC)': 3004,
    'GRADIENT FROSTED STICKER (UV-SC)': 3005,
    'GRADIENT FROSTED STICKER (UV-MC)': 3006,
    'BLANK FROSTED STICKER': 3007,
    'Decal Sticker (Colored / Printed Vinyl)': 3008,
    'Vehicle  Vinyl Letters (Decal)': 3009,
    'RTA Vehicle Permit Charges (Decal)': 3010,
    'Window Branding Clear Film ECO (Indoor/Outdoor)': 3011,
    'Window Branding Clear Film UV (Indoor/Outdoor)': 3012,
    'Window Branding Clear Film ECO (Reverse)': 3013,
    'Window Branding Clear Film UV (Reverse)': 3014,
    'Window Branding Double Sided': 3015,
    'Window / Wall Branding Sticker (Indoor-Promotional-ECO)': 3016,
    'Window / Wall Branding Sticker (Indoor-Permanent-ECO)': 3017,
    'Window / Wall Branding Sticker (Indoor-Permanent-UV)': 3018,
    'Window / Wall Branding Sticker (Outdoor-Promotional-ECO)': 3019,
    'Window / Wall Branding Sticker (Outdoor-Permanent-ECO)': 3020,
    'Window / Wall Branding Sticker (Outdoor-Permanent-UV)': 3021,

    'One Way Vision Window Film (ECO)': 3022,
    'One Way Vision Window Film (UV)': 3023,
    'Window Glass Tinting (Black)': 3024,
    'Window Glass Tinting (Mirror)': 3025,
    'Window Glass Tinting (Color)': 3026,
    'Wall Branding Sticker ECO (Forex)': 3027,
    'Wall Branding Sticker UV (Forex)': 3028,
    'Wall Paper with Printing ECO (Textured)': 3029,
    'Canvas Frame (A4 to A0 Size)': 3030,
    'Canvas Frame ECO (Customized)': 3031,
    'Canvas Frame UV (Customized)': 3032,
    'Canvas Pennant ECO (A4 to A0 Sizes)': 3033,
    'Canvas Pennant (Customized)': 3034,
    'Canvas Printing (ECO / UV)': 3035,
    'Photo Frame (Wooden Bedding)': 3036,
    'Acrylic Sandwich Frame (3+3mm)': 3037,
    'Acrylic Sandwich Frame (4+4mm)': 3038,
    'Acrylic Sandwich Frame (5+5mm)': 3039,
    'Acrylic Divider (5mm)': 3040,
    'Acrylic Divider (6mm)': 3041,
    'Acrylic Wall Protection Sheet (3mm)': 3042,
    'Posters Price List': 3043,
    'Poster with 5mm Foam Board': 3044,
    'Poster with 10mm Foam Board': 3045,
    'Poster with 3mm Forex Board': 3046,
    'Poster with 5mm Forex Board': 3047,
    'Poster with 10mm Forex Board': 3048,
    'Poster with Hanging Rails': 3049,
    'Vehicle Branding - Partial Wrap': 3050,
    'RTA Vehicle Permit Charges (Partial Wrap)': 3051,
    'Vehicle Branding - Full Wrap S/C': 3052,
    'Vehicle Branding - Full Wrap F/C': 3053,
    'RTA Vehicle Permit Charges (Full Wrap)': 3054,
    'Car Magnet with Vehicle Graphics': 3055,
    'Car Magnet with Outdoor Sticker': 3056,
    'Fridge Magnet Stickers': 3057,
    'Boat Decal': 3058,
    'Boat Branding (Full / Partial)': 3059,
    'Magnet White Board': 3060,
    'Floor Graphics with Installation': 3061,
    'Floor Stickers Supply Only': 3062,
    'Indoor Sticker Supply Only (ECO)': 3063,
    'Outdoor Sticker Supply Only (ECO)': 3064,
    'Sticker White Back with UV Printing Supply': 3065,
    'Sticker Transparent Supply Only (ECO)': 3066,
    'Sticker Transparent Supply Only (UV)': 3067,
    'PVC Banner (ECO)': 3068,
    'PVC Mesh Banner (ECO)': 3069,
    'PVC Banner (UV)': 3070,
    'PVC Mesh Banner (UV)': 3071,
    'PVC Flex Backlit (ECO)': 3072,
    'PVC Flex Backlit (UV)': 3073,
    'PVC Block Out Banner (ECO)': 3074,
    'PVC Block Out Banner (UV)': 3075,
    'Reflective Sticker Printed (ECO)': 3076,
    'Reflective Sticker Printed (UV)': 3077,
    'Reflective Sticker (Non Printable)': 3078,
    'Duratrans Film (ECO / UV)': 3079,
    'Poster Backlit (ECO / UV)': 3080,
    'Cling / Static Film (ECO / UV)': 3081,
    'Dividers (Self Standing)': 3082,
    'PVC Stencil': 3083,
    'Sticker Stencil (Vinyl)': 3084,
    'Metal Stencil (Coffee)': 3085,
    'Metal Stencil (Generic)': 3086,
    'Table Top Stand Acrylic (T-Type)': 3087,
    'Table Top Stand Acrylic (L-Type)': 3088,
    'Table Top Stand (Forex)': 3089,
    'Easy Swap Poster Stand': 3090,
    'Poster Trap Stand (Fixed)': 3091,
    'Poster Trap Stand (Portable)': 3092,
    'Poster Stopper Stand (Outdoor)': 3093,
    'Poster A Stand': 3094,
    'Poster Menu Stand': 3095,
    'Window / Wall Branding 3M (Permanent) Gray Back': 3096,
    'Poster / Photo Snap Frame': 3097,
    'Removal Charges (Sticker)': 3098,
    'Gondola (Forex)': 3099,
    'Gondola (Wooden)': 3100,
    'Table Top A Stand (SS)': 3101,
    'Table Top A Stand (Acrylic)': 3102,
    'Dangler (Forex)': 3103,
    'Table Top Base Stand (Wooden)': 3104,
    'Vehicle Branding - Flat': 3105,
    'Poster / Photo Backlit Frame (Slim)': 3106,
    'Canvas Floating Frame': 3107,
    'Que Stand Retractable': 3108,
    'PVC / Acrylic Stencil (Coffee)': 3109,
    'Wooden Pedestal / Stand': 3110,

    'Unlit 3D Signage (Acrylic)': 4001,
    'Unlit 3D Signage (Solid Metal)': 4002,
    'Unlit 3D Signage (Acrylic + Metal)': 4003,
    'Unlit 3D Signage (Aluminum PC)': 4004,
    'Unlit 3D Signage (SS)': 4005,
    'Unlit 3D Signage (Wooden)': 4006,
    'Front & Backlit 3D Signage': 4007,
    'Frontlit Signage 3D Channelium Letters': 4008,
    'Frontlit Signage 3D Acrylic Box Letters': 4009,
    'Frontlit Signage 3D SS Letters': 4010,
    'Frontlit Signage 3D Aluminum Letters': 4011,
    'Backlit Signage 3D Aluminum Letters': 4012,
    'Backlit Signage 3D SS Letters': 4013,
    'Backlit Signage 3D Acrylic Letters': 4014,
    'Backlit Signage 3D SS Electro Plated Letters': 4015,
    'Backlit Signage 3D Wooden Letters': 4016,
    'Outlit Signage 3D Aluminum Letters': 4017,
    'Outlit Signage 3D SS Letters': 4018,
    'Outlit Signage 3D SS Electro Plated Letters': 4019,
    'Outlit Signage 3D Acrylic Letters': 4020,
    'Outlit Signage 3D Wooden Letters': 4021,
    'Push Through Signage Acrylic + Letters': 4022,
    'Push Through Signage SS + Letters': 4023,
    'Push Through Signage Aluminum PC + Letters': 4024,
    'Push Through Signage ACP + Letters': 4025,
    'Push Through Signage Wooden + Letters': 4026,
    'Neon Signage + Acrylic': 4027,
    'Neon Signage + SS': 4028,
    'Neon Signage + Aluminum': 4029,
    'Neon Signage + Wood': 4030,
    'Neon Signage + Complete Board': 4031,
    'Unilt Signage ACP': 4032,
    'Lightbox Signage Flex Face': 4033,
    'Lightbox Signage Acrylic': 4034,
    'Lightbox Signage Fabric': 4035,
    'Lightbox Signage Forex': 4036,
    'Lightbox Signage Metal': 4037,
    'Lightbox Signage Wooden': 4038,
    'Pole Signage Frontlit': 4039,
    'Pole Signage Unlit': 4040,
    'Direction Signage Self-Stand': 4041,
    'Direction Signage Wall-Mount': 4042,
    'Direction Signage Hanging': 4043,
    'Directory Signage': 4044,
    'Self Standing Letters Metal': 4045,
    'Self Standing Letters Wooden': 4046,
    'Self Standing Letters Acrylic': 4047,
    'Self Standing Letters Forex': 4048,
    'Self Standing Letters Styro Foam': 4049,
    'Name Plate SS': 4050,
    'Name Plate ACP': 4051,
    'Name Plate Acrylic': 4052,
    'Name Plate Wooden': 4053,
    'Name Plate Forex': 4054,
    'Name Plate Table Top': 4055,
    'Safety Signage Self-Stand': 4056,
    'Safety Signage Wall-Mount': 4057,
    'Safety Signage Floor-Mount': 4058,
    'Label Traffolyte / PVC': 4059,
    'Label Stainless Steel': 4060,
    'Label Aluminum': 4061,
    'Label Acrylic': 4062,
    'Label Wooden': 4063,
    'Water Bottle Label': 4064,
    'Construction Signage Unlit': 4065,
    'Self Standing Signage': 4066,
    'Hanging Signage': 4067,
    'Name Plate Aluminum': 4068,
    'Name Plate Profile': 4069,
    'Acrylic Stand (Customized)': 4070,
    'Fence Board Branding': 4071,
    'Metal Stencil': 4072,
    'Signboard Stand (A Type) (Metal)': 4073,
    'Signboard Stand (T Type)': 4074,

    'Installation Event (Fashion & Fabric)': 5000,
    'Sail Flag - Compact': 5001,
    'Sail Flag - Small': 5002,
    'Sail Flag - Medium': 5003,
    'Sail Flag - large': 5004,
    'L shape flag - Compact': 5005,
    'L shape flag - Small': 5006,
    'L shape flag - Medium': 5007,
    'L Shape flag - Large': 5008,
    'Tear Drop flag Small': 5009,
    'Tear Drop Flag - Medium': 5010,
    'Tear Drop Flag - Large': 5011,
    'Blade Flag Small': 5012,
    'Water Base': 5013,
    'Blade Flag Large': 5014,
    'Concrete Base': 5015,
    'Metal Base': 5016,
    'Bunting flags – A5': 5017,
    'Chrome Finish Base': 5018,
    'Metal Base with Concrete Filing 50kgs': 5019,
    'Hand held Flags': 5020,
    'Concrete Base Square 30kgs': 5021,
    'Body flag': 5022,
    'Fan Scarf': 5023,
    'Hoisting Flag': 5024,
    'Granite Base': 5025,
    'Metal Base Round': 5026,
    'Metal Base Square': 5027,
    'FESTIVAL FLAGS': 5028,
    'Chrome Plated Cross Base': 5029,
    'White Cross Base': 5030,
    'Fiber Base': 5031,
    'Forex Base': 5032,
    'T-550 Water Base': 5033,
    'Clamps': 5034,
    'Conference flags': 5035,
    'ROYAL CONFERENCE FLAGS': 5036,
    'Table Flag Premium': 5037,
    'Head Bandana': 5038,
    'Table Flag Royal': 5039,
    'Table Flag - Pole shape: L': 5040,
    'Table Flag V shape Small': 5041,
    'Table Flag V Shape Large': 5042,
    'Toothpick Flags': 5043,
    'Pole Flag': 5044,
    'Spike Base': 5045,
    'FINISH LINE': 5046,
    'Square Concrete Base 75kgs': 5047,
    'Square Concrete Base 160kgs': 5048,
    'Pyramid Concrete Base 250kgs': 5049,
    'Wall Mounted Flags': 5050,
    'Stadium Flags': 5051,
    'Table flag': 5052,
    'Table flag V cut Standard': 5053,
    'Table Flag Tripole': 5054,

    'Pop Up 1x3 - Softcase': 6001,
    'Pop Up 1x3 Hardcase': 6002,
    'Pop Up 2x3 Softcase': 6003,
    'Pop Up 2x3 Hard Case': 6004,
    'Pop Up 3x3 Softcase': 6005,
    'Pop Up 3x3 Hardcase': 6006,
    'Pop Up 4x3 Softcase': 6007,
    'Pop Up 4x3 Hardcase': 6008,
    'Pop Up 5x3 Soft Case': 6009,
    'Pop Up 5x3 Hardcase': 6010,
    'Pop Up 6x3 Softcase': 6011,
    'Pop Up 6x3 Hardcase': 6012,
    'Pop up Trolley Case - Hard Case': 6013,
    'POP Up Re Branding': 6014,
    'Pop Up Rental': 6015,
    'Pop Up Trolley Counter': 6016,
    'Pop Up Counter': 6017,
    'Promotional Table PVC': 6018,
    'Promotional Table Aluminum': 6019,
    'Fabric Pop Up 3x3': 6020,
    'Fabric Pop Up 4x3 Straight': 6021,
    'Fabric Curved Backdrop': 6022,
    'Fabric - Round backdrop': 6023,
    'Roll Up A4/A3': 6029,
    'Roll Up (Standard) All': 6030,
    'Roll Up (Premium) All': 6031,
    'Roll Up (Broad base) All': 6032,
    'Roll Up (Double Sided) All': 6033,
    'Roll Up Fabric (Standard)': 6035,
    'Roll Up Fabric (Broad Base)': 6036,
    'X Standee - 160': 6037,
    'X Standee - 180': 6038,
    'Fabric Banner': 6039,
    'Fabric Mesh Banner': 6040,
    'Wooden Backdrop (PVC Banner)': 6041,
    'Wooden Backdrop - Rental (PVC Banner)': 6042,
    'Wooden Backdrop (Media Wall)': 6043,
    'Wooden Backdrop with Base': 6044,
    'Wooden Media Wall (Curved)': 6045,
    'Mosaic Wall Backdrop': 6046,
    'Wooden Backdrop (Foldable)': 6047,
    'Foldable Backdrop (Forex / Foam)': 6048,
    'Iron Backdrop': 6049,
    'Party Backdrop (3D Letters & LED)': 6050,
    'Step & Repeat Backdrop (PVC)': 6051,
    'Step & Repeat Backdrop (Fabric)': 6052,
    'FABRIC STANDEE – Style 1': 6053,
    'FABRIC STANDEE - Style 2': 6054,
    'Fabric Spring A-board (Horizontal)': 6065,
    'Fabric Spring A-board (Vertical)': 6066,
    'Toblerone (Fabric)': 6067,
    'Toblerone Stand (Forex)': 6068,
    'Toblerone Stand (Wooden Fixed)': 6069,
    'Toblerone Stand (Wooden Foldable)': 6070,
    'Cutout Standee (Forex)': 6072,
    'Cutout Standee (Wooden)': 6073,
    'Cutout Standee (Metal)': 6074,
    'Cutout Standee (Acrylic)': 6075,
    'Hashtag Cut-Out': 6076,
    'Party Props Cutout (Forex)': 6077,
    'Totem Standee (Forex)': 6078,
    'Totem Standee (Wooden)': 6079,
    'Lama Stand (Forex)': 6080,
    'Social Media Photo Frame': 6081,
    'Spinning Wheel': 6082,
    'Easel Stand': 6083,
    'Shell Scheme Booth (Panel Branding)': 6084,
    'Shell Scheme Booth (Seamless Branding - Foam)': 6085,
    'Shell Scheme Booth (Seamless Branding - Banner)': 6086,

    'Fabric Hydraulic Counter (Oval)': 6087,
    'Fabric Hydraulic Counter (Rectangle)': 6088,
    'Fabric Pop up Counter': 6089,
    'Tent: 2 x 2m': 6090,
    'Tent (3x3)': 6091,
    'Tent (4.5x3)': 6092,
    'Tent (6x3)': 6093,
    'Dinning Table Cloth': 6094,
    'Table Cover': 6095,
    'Table Runner': 6096,
    'Fabric Backlit Standee Classic – Rental': 6097,
    'Fabric Backlit Backdrop (2 x 2.25) Rental': 6098,
    'Fabric Backlit Backdrop (3 x 2.25) Rental': 6099,
    'Fabric Backlit Backdrop (4 x 2.25) Rental': 6100,
    'Fabric Backlit Backdrop (5 x 2.25) Rental': 6101,
    'Snap Fold Fabric Backlit Standee': 6102,
    'Removal Charges (Backdrop)': 6103,
    'Arch (Wooden)': 6104,
    'Arch (Metal)': 6105,
    'Fabric Spring A-board (Triangle)': 6106,
    'Fabric Spring A-board (Round)': 6107,
    'Wooden Backdrop (Rounded)': 6108,
    'Balloon Arch (Standard)': 6109,
    'Balloon Arch (Organic)': 6110,
    'Balloon Party Backdrop (Glimmer)': 6111,
    'Balloon Party Backdrop (Themed)': 6112,
    'Balloon Party Backdrop (Acrylic Cake Stand)': 6113,
    'Balloon Birthday Setup': 6114,
    'Helium Balloon (Plain)': 6115,
    'Bubble Balloon': 6116,
    'Cake Stands (Balloon Backdrop)': 6117,
    'Cubes (Forex)': 6118,
    'Cubes (Wooden)': 6119,
    'Cubes (Acrylic - Unlit)': 6120,
    'Cubes (Acrylic - Backlit)': 6121,
    'Floor Platform Wooden + Vinyl': 6122,
    'Floor Platform Wooden + Carpet / PVC': 6123,
    'Exhibition Stand (Customized)': 6124,
    'Giant Cheque (Foamboard)': 6125,
    'Magazine Photo Booth': 6127,
    'Photo Booth Stage': 6128,
    'Fabric Backlit Backdrop for Sale': 6129,
    'Tyvek wristbands': 7014
}

const productIdToName = Object.fromEntries(
    Object.entries(productMap).map(([productName, productId]) => [
        String(productId),
        productName
    ])
)

const normalizeCompanyName = (value = "") => {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

const getProductsFromDescription = (description = "") => {
    const productIds = String(description)
        .match(/\d+/g) || []

    const uniqueProductIds = [
        ...new Set(productIds)
    ]

    const products = []

    for (const productId of uniqueProductIds) {
        const productName =
            productIdToName[String(productId)]

        if (!productName) {
            continue
        }

        products.push({
            productName: productName,
            productId: Number(productId)
        })
    }

    return products
}

// Pick the single lead to attach this quote to when a company
// has more than one open/eligible lead in the CRM.
// "Most recent" = most recently created document (createdAt from timestamps: true).
// If your `leadAddedDate` is a more reliable "created" signal in your data
// (e.g. leads get backfilled/imported), swap the field used below.
const pickTargetLead = (leads = []) => {
    const eligible = leads.filter(
        lead => !["Quoted", "Won"].includes(lead.dealStatus)
    )

    if (eligible.length === 0) {
        return null
    }

    return eligible.reduce((latest, lead) => {
        const latestTime = new Date(latest.createdAt || latest.leadAddedDate || 0).getTime()
        const leadTime = new Date(lead.createdAt || lead.leadAddedDate || 0).getTime()

        return leadTime > latestTime ? lead : latest
    })
}

const syncTodayQuotes = async () => {
    try {
        console.log("Starting today's quotes sync...")

        const [ddaQuotes, stationeryQuotes] = await Promise.all([
            managerSyncDailyQuotesOfDDA(),
            managerSyncDailyQuotesStationery()
        ])

        const quotes = [...ddaQuotes, ...stationeryQuotes]

        if (quotes.length === 0) {
            return
        }

        const leads = await Data.find({
            dealStatus: {
                $nin: ["Quoted", "Won"]
            },

            companyName: {
                $exists: true,
                $nin: ["", null]
            }
        })

        const leadsByCompany = new Map()

        for (const lead of leads) {
            const normalizedCompany = normalizeCompanyName(
                lead.companyName
            )

            if (!normalizedCompany) {
                continue
            }

            if (!leadsByCompany.has(normalizedCompany)) {
                leadsByCompany.set(
                    normalizedCompany,
                    []
                )
            }

            leadsByCompany.get(normalizedCompany).push(lead)
        }

        let matched = 0;
        let modified = 0;
        let skipped = 0
        let failed = 0

        for (const quote of quotes) {
            try {
                const customer = quote?.customer
                const reference = quote?.reference
                const description = quote?.description || ""

                if (!customer || !reference) {
                    skipped++
                    continue
                }

                const quoteNumber = Number(reference)

                if (!Number.isFinite(quoteNumber)) {
                    skipped++
                    continue
                }


                const normalizedCustomer = normalizeCompanyName(customer)

                if (!normalizedCustomer) {
                    skipped++
                    continue
                }


                const products = getProductsFromDescription(description)

                if (products.length === 0) {
                    skipped++
                    continue
                }

                const matchingLeads = leadsByCompany.get(normalizedCustomer) || []

                if (matchingLeads.length === 0) {
                    skipped++
                    continue
                }

                // Edge case fix: a company can have multiple open leads in CRM
                // (duplicate entries, different sales reps, re-inquiries, etc).
                // Only the most recently created eligible lead should be updated
                // for this quote - not all of them.
                const targetLead = pickTargetLead(matchingLeads)
                if (!targetLead) {
                    skipped++
                    continue
                }

                // if (matchingLeads.length > 1) {
                //     console.log(
                //         `Customer ${customer} has ${matchingLeads.length} eligible leads - `
                //         + `using most recent (id: ${targetLead._id}, created: ${targetLead.createdAt || targetLead.leadAddedDate})`
                //     )
                // }

                const result =
                    await Data.updateOne(
                        {
                            _id: targetLead._id,
                            // Re-check status at write time in case something else
                            // (a manual edit, a parallel run) changed it since the fetch.
                            dealStatus: {
                                $nin: [
                                    "Quoted",
                                    "Won"
                                ]
                            }
                        },
                        {
                            $set: {
                                dealStatus: "Quoted",
                                quoteNumber: quoteNumber,
                                quoteDate: quote.issueDate,
                                dealAmount: quote?.amount?.value,
                                products: products
                            }
                        }
                    )

                matched += result.matchedCount || 0
                modified += result.modifiedCount || 0

                // console.log(
                //     `Quote ${reference} -> ${customer} -> ${result.modifiedCount} lead(s) updated`
                // )
            }
            catch (quoteError) {
                failed++
                console.error(
                    `Failed to process quote ${quote?.reference || "Unknown"}:`,
                    quoteError.message
                )
            }
        }
    } catch (error) {
        console.error(
            "Manager invoice sync failed:",
            error.response?.data || error.message
        )
    }
}


// Guard against overlapping runs (e.g. if a run takes unexpectedly
// long or the process is triggered manually while a scheduled run is still in progress).
let isSyncRunning = false

cron.schedule(
    "0 22 * * *",
    async () => {
        if (isSyncRunning) {
            return
        }

        isSyncRunning = true

        try {
            await syncTodayQuotes()
        } finally {
            isSyncRunning = false
        }
    },
    {
        timezone: "Asia/Kolkata"
    }
)
