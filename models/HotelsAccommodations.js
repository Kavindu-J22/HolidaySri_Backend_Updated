const mongoose = require('mongoose');

const hotelsAccommodationsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedAdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advertisement',
    required: true
  },
  
  // Basic Information
  hotelName: {
    type: String,
    required: true,
    trim: true
  },
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Hotels',
      'Apartments',
      'Resorts',
      'Villas',
      'Guest Houses',
      'Homestays',
      'Boutique Hotels',
      'Hostels',
      'Lodges',
      'Bungalows',
      'Eco Lodges',
      'Beach Hotels',
      'City Hotels',
      'Bed & Breakfast',
      'Cottages',
      'Chalets',
      'Farmstays',
      'Treehouse',
      'Floating Hotels',
      'Heritage Hotels',
      'Motels',
      'Service Apartments'
    ]
  },
  description: {
    type: String,
    required: true
  },
  climate: {
    type: String,
    required: true,
    enum: [
      'Dry zone',
      'Intermediate zone',
      'Montane zone',
      'Semi-Arid zone',
      'Oceanic zone',
      'Tropical Wet zone',
      'Tropical Submontane',
      'Tropical Dry Zone',
      'Tropical Monsoon Climate'
    ]
  },
  
  // Location
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    mapUrl: { type: String, required: true }
  },
  
  // Contact Information
  contactInfo: {
    email: { type: String, required: true },
    contactNumber: { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    facebookUrl: { type: String },
    websiteUrl: { type: String }
  },
  
  // Facilities (60+ comprehensive list)
  facilities: {
    // Basic Amenities
    internet: { type: Boolean, default: false },
    freeWiFi: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    freeParking: { type: Boolean, default: false },
    valetParking: { type: Boolean, default: false },
    airConditioning: { type: Boolean, default: false },
    heating: { type: Boolean, default: false },
    elevator: { type: Boolean, default: false },
    wheelchairAccess: { type: Boolean, default: false },

    // Dining & Kitchen
    restaurant: { type: Boolean, default: false },
    bar: { type: Boolean, default: false },
    rooftopBar: { type: Boolean, default: false },
    cafe: { type: Boolean, default: false },
    roomService: { type: Boolean, default: false },
    bbqFacilities: { type: Boolean, default: false },
    sharedKitchen: { type: Boolean, default: false },
    kitchenette: { type: Boolean, default: false },
    diningArea: { type: Boolean, default: false },
    wineCellar: { type: Boolean, default: false },
    farmToTableDining: { type: Boolean, default: false },

    // Recreation & Wellness
    swimmingPool: { type: Boolean, default: false },
    indoorPool: { type: Boolean, default: false },
    outdoorPool: { type: Boolean, default: false },
    rooftopPool: { type: Boolean, default: false },
    infinityPool: { type: Boolean, default: false },
    kidsPool: { type: Boolean, default: false },
    gym: { type: Boolean, default: false },
    fitnessCenter: { type: Boolean, default: false },
    spa: { type: Boolean, default: false },
    spaAndWellness: { type: Boolean, default: false },
    sauna: { type: Boolean, default: false },
    steamRoom: { type: Boolean, default: false },
    hotTub: { type: Boolean, default: false },
    jacuzzi: { type: Boolean, default: false },
    outdoorJacuzzi: { type: Boolean, default: false },
    massageServices: { type: Boolean, default: false },
    yogaDeck: { type: Boolean, default: false },
    meditationRoom: { type: Boolean, default: false },

    // Entertainment
    gameRoom: { type: Boolean, default: false },
    karaokeRoom: { type: Boolean, default: false },
    movieTheater: { type: Boolean, default: false },
    library: { type: Boolean, default: false },
    artGallery: { type: Boolean, default: false },
    casino: { type: Boolean, default: false },
    nightclub: { type: Boolean, default: false },
    liveMusic: { type: Boolean, default: false },

    // Outdoor & Nature
    garden: { type: Boolean, default: false },
    terrace: { type: Boolean, default: false },
    rooftopTerrace: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false },
    patio: { type: Boolean, default: false },
    privateBeach: { type: Boolean, default: false },
    beachAccess: { type: Boolean, default: false },
    beachfront: { type: Boolean, default: false },
    lakeAccess: { type: Boolean, default: false },
    firepit: { type: Boolean, default: false },
    picnicArea: { type: Boolean, default: false },
    birdWatchingArea: { type: Boolean, default: false },
    hikingTrails: { type: Boolean, default: false },

    // Sports & Activities
    tennisCourt: { type: Boolean, default: false },
    badmintonCourt: { type: Boolean, default: false },
    basketballCourt: { type: Boolean, default: false },
    volleyballCourt: { type: Boolean, default: false },
    golfCourse: { type: Boolean, default: false },
    miniGolf: { type: Boolean, default: false },
    tableTennis: { type: Boolean, default: false },
    billiards: { type: Boolean, default: false },
    waterSports: { type: Boolean, default: false },
    divingCenter: { type: Boolean, default: false },
    snorkeling: { type: Boolean, default: false },
    fishing: { type: Boolean, default: false },
    fishingPond: { type: Boolean, default: false },
    skiStorage: { type: Boolean, default: false },
    skiToSki: { type: Boolean, default: false },

    // Family & Kids
    kidsPlayArea: { type: Boolean, default: false },
    kidsClub: { type: Boolean, default: false },
    playground: { type: Boolean, default: false },
    babysittingService: { type: Boolean, default: false },
    familyRooms: { type: Boolean, default: false },

    // Business & Events
    conferenceRoom: { type: Boolean, default: false },
    meetingRooms: { type: Boolean, default: false },
    businessCenter: { type: Boolean, default: false },
    coworkingSpace: { type: Boolean, default: false },
    banquetHall: { type: Boolean, default: false },
    Weddinghall: { type: Boolean, default: false },
    eventSpace: { type: Boolean, default: false },
    ballroom: { type: Boolean, default: false },

    // Services
    laundryService: { type: Boolean, default: false },
    dryCleaningService: { type: Boolean, default: false },
    ironingService: { type: Boolean, default: false },
    conciergeService: { type: Boolean, default: false },
    tourDesk: { type: Boolean, default: false },
    ticketService: { type: Boolean, default: false },
    currencyExchange: { type: Boolean, default: false },
    luggageStorage: { type: Boolean, default: false },
    shoeShine: { type: Boolean, default: false },
    dailyHousekeeping: { type: Boolean, default: false },

    // Transportation
    airportShuttle: { type: Boolean, default: false },
    freeAirportShuttle: { type: Boolean, default: false },
    carRental: { type: Boolean, default: false },
    bikeRental: { type: Boolean, default: false },
    electricVehicleCharging: { type: Boolean, default: false },
    EVChargingStation: { type: Boolean, default: false },
    shuttleService: { type: Boolean, default: false },

    // Safety & Security
    cctv: { type: Boolean, default: false },
    securityGuard: { type: Boolean, default: false },
    fireExtinguisher: { type: Boolean, default: false },
    smokeDetector: { type: Boolean, default: false },
    firstAidKit: { type: Boolean, default: false },
    safe: { type: Boolean, default: false },

    // Special Features
    petFriendly: { type: Boolean, default: false },
    smokingArea: { type: Boolean, default: false },
    nonSmokingRooms: { type: Boolean, default: false },
    soundproofRooms: { type: Boolean, default: false },
    chef: { type: Boolean, default: false },
    privateChef: { type: Boolean, default: false },
    butler: { type: Boolean, default: false },
    chapel: { type: Boolean, default: false },
    atm: { type: Boolean, default: false },
    giftShop: { type: Boolean, default: false },
    beautyShop: { type: Boolean, default: false },
    barberShop: { type: Boolean, default: false }
  },
  
  // Dining Options
  diningOptions: {
    breakfastIncluded: { type: Boolean, default: false },
    breakfastInfo: { type: String },
    breakfastCharge: { type: Number },
    restaurantOnSite: { type: Boolean, default: false },
    restaurantInfo: { type: String },
    menuPDF: {
      url: { type: String },
      publicId: { type: String }
    }
  },
  
  // Function Options
  functionOptions: {
    weddingHall: { type: Boolean, default: false },
    conferenceHall: { type: Boolean, default: false },
    banquetFacility: { type: Boolean, default: false },
    meetingRooms: { type: Boolean, default: false },
    eventSpace: { type: Boolean, default: false },
    packagesPDF: {
      url: { type: String },
      publicId: { type: String }
    }
  },
  
  // Policies
  policies: {
    allowsLiquor: { type: Boolean, default: false },
    allowsSmoking: { type: Boolean, default: false },
    cancellationPolicy: { 
      type: String, 
      default: 'Free cancellation within 24 hours of booking. Charges may apply beyond this period.' 
    },
    checkInTime: { type: String, default: '2:00 PM' },
    checkOutTime: { type: String, default: '12:00 PM' },
    pets: { type: Boolean, default: false },
    petPolicyDetails: { type: String },
    parties: { type: Boolean, default: false },
    partyPolicyDetails: { type: String },
    childPolicy: { 
      type: String, 
      default: 'Children of all ages are welcome. Additional charges may apply for extra bedding.' 
    },
    ageRestriction: { type: Boolean, default: false },
    minimumCheckInAge: { type: Number, default: 18 },
    damageDeposit: { type: Boolean, default: false },
    damageDepositAmount: { type: Number, default: 0 },
    refundPolicy: { 
      type: String, 
      default: 'Refunds are processed within 7 business days of cancellation.' 
    },
    noShowPolicy: { 
      type: String, 
      default: 'No-shows are charged 100% of the booking amount.' 
    },
    lateCheckOutPolicy: { 
      type: String, 
      default: 'Late check-out is subject to availability and may incur additional charges.' 
    },
    earlyCheckInPolicy: { 
      type: String, 
      default: 'Early check-in is subject to availability and may incur additional charges.' 
    },
    quietHours: { type: String, default: '' },
    additionalCharges: { 
      type: String, 
      default: 'Additional charges may apply for extra guests, special requests, or facilities usage.' 
    },
    taxAndCharges: { type: Boolean, default: false },
    taxAndChargesAmount: { type: Number, default: 0 },
    acceptedPaymentMethods: {
      type: [String],
      default: []
    }
  },
  
  // Activities
  activities: {
    onsiteActivities: { type: [String], default: [] },
    nearbyAttractions: { type: [String], default: [] },
    nearbyActivities: { type: [String], default: [] }
  },
  
  // Images
  images: {
    type: [{
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    }],
    validate: [arrayLimit, 'Maximum 5 images allowed']
  },
  
  // Other Information
  otherInfo: {
    type: [String],
    default: []
  },
  
  // Verification and Rating
  isHaveStars: { type: Boolean, default: false },
  howManyStars: { type: Number, min: 1, max: 5 },
  isVerified: { type: Boolean, default: false },
  isHaveCertificate: { type: Boolean, default: false },
  isHaveLicense: { type: Boolean, default: false },
  acceptTeams: { type: Boolean, default: false },
  
  // Engagement Metrics
  isActive: { type: Boolean, default: true },
  viewCount: { type: Number, default: 0 },
  contactCount: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },

  publishedAt: {
    type: Date,
    default: Date.now
  },

  // Rooms (max 3 free rooms)
  rooms: {
    type: [{
    roomName: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'Single Room',
        'Double Room',
        'Twin Room',
        'Triple Room',
        'Quad Room',
        'King Room',
        'Queen Room',
        'Suite',
        'Deluxe Room',
        'Executive Room',
        'Presidential Suite',
        'Family Room',
        'Studio',
        'Penthouse',
        'Villa',
        'Bungalow',
        'Cottage',
        'Dormitory',
        'Connecting Rooms',
        'Adjoining Rooms'
      ]
    },
    capacity: {
      type: Number,
      required: true,
      min: 1
    },
    beds: {
      type: String,
      required: true,
      trim: true
    },
    roomDescription: {
      type: String,
      required: true,
      trim: true
    },
    pricePerNight: {
      type: Number,
      required: true,
      min: 0
    },
    pricePerFullDay: {
      type: Number,
      required: true,
      min: 0
    },
    pricing: {
      fullboardPrice: { type: Number, min: 0 },
      fullboardInclude: {
        type: [String],
        default: []
      },
      halfboardPrice: { type: Number, min: 0 },
      halfboardInclude: {
        type: [String],
        default: []
      }
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    amenities: {
      type: [String],
      default: []
    },
    images: {
      type: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
      }],
      validate: [arrayLimit, 'Maximum 5 images allowed per room']
    },
    noOfRooms: {
      type: Number,
      required: true,
      min: 1
    },
    roomOpenForAgents: {
      type: Boolean,
      default: false
    },
    discountForPromo: {
      type: Number,
      min: 0,
      default: 0
    },
    earnRateForPromo: {
      type: Number,
      min: 0,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
    default: []
  },

  // Reviews and ratings
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    reviewText: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Validator for max images
function arrayLimit(val) {
  return val.length <= 5;
}

// Indexes for better query performance
hotelsAccommodationsSchema.index({ userId: 1 });
hotelsAccommodationsSchema.index({ publishedAdId: 1 });
hotelsAccommodationsSchema.index({ category: 1 });
hotelsAccommodationsSchema.index({ 'location.province': 1, 'location.city': 1 });
hotelsAccommodationsSchema.index({ climate: 1 });
hotelsAccommodationsSchema.index({ isActive: 1 });

module.exports = mongoose.model('HotelsAccommodations', hotelsAccommodationsSchema);

