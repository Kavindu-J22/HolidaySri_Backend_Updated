const mongoose = require('mongoose');

const advertisementSlotChargesSchema = new mongoose.Schema({
  // Home Banner Slot (special pricing with hourly option)
  homeBanner: {
    hourlyCharge: {
      type: Number,
      required: true,
      default: 500 // LKR per hour
    },
    dailyCharge: {
      type: Number,
      required: true,
      default: 5000 // LKR per day
    },
    monthlyCharge: {
      type: Number,
      required: true,
      default: 100000 // LKR per month
    },
    yearlyCharge: {
      type: Number,
      required: true,
      default: 1000000 // LKR per year
    }
  },

  // Tourism And Travel Category Slots
  tourismTravel: {
    travelBuddys: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 25000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 250000 // LKR per year
      }
    },
    tourGuiders: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    },
    localTourPackages: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1200 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 30000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 300000 // LKR per year
      }
    },
    customizeTourPackage: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 35000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 350000 // LKR per year
      }
    },
    travelSafeHelpProfessionals: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 900 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 22000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 220000 // LKR per year
      }
    },
    rentLandCampingParking: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 700 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 18000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 180000 // LKR per year
      }
    }
  },

  // Accommodation & Dining Category Slots
  accommodationDining: {
    hotelsAccommodations: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 40000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 400000 // LKR per year
      }
    },
    cafesRestaurants: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1200 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 30000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 300000 // LKR per year
      }
    },
    foodsBeverages: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    }
  },

  // Vehicles & Transport Category Slots
  vehiclesTransport: {
    vehicleRentalsHire: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1300 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 32000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 320000 // LKR per year
      }
    },
    liveRidesCarpooling: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 600 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 15000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 150000 // LKR per year
      }
    },
    professionalDrivers: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    },
    vehicleRepairsMechanics: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 700 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 18000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 180000 // LKR per year
      }
    }
  },

  // Events & Management Category Slots
  eventsManagement: {
    eventsUpdates: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 25000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 250000 // LKR per year
      }
    },
    eventPlannersCoordinators: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1400 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 35000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 350000 // LKR per year
      }
    },
    creativePhotographers: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1200 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 30000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 300000 // LKR per year
      }
    },
    decoratorsFlorists: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 900 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 22000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 220000 // LKR per year
      }
    },
    salonMakeupArtists: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1100 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 28000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 280000 // LKR per year
      }
    },
    fashionDesigners: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1300 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 32000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 320000 // LKR per year
      }
    }
  },

  // Professionals & Services Category Slots
  professionalsServices: {
    expertDoctors: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 2000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 50000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 500000 // LKR per year
      }
    },
    professionalLawyers: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 45000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 450000 // LKR per year
      }
    },
    advisorsCounselors: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1200 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 30000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 300000 // LKR per year
      }
    },
    languageTranslators: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    },
    expertArchitects: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1600 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 40000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 400000 // LKR per year
      }
    },
    trustedAstrologists: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 600 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 15000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 150000 // LKR per year
      }
    },
    deliveryPartners: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 12000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 120000 // LKR per year
      }
    },
    graphicsItTechRepair: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 25000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 250000 // LKR per year
      }
    },
    educationalTutoring: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 900 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 22000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 220000 // LKR per year
      }
    },
    currencyExchange: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 35000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 350000 // LKR per year
      }
    },
    otherProfessionalsServices: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 700 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 18000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 180000 // LKR per year
      }
    }
  },

  // Caring & Donations Category Slots
  caringDonations: {
    caregiversTimeCurrency: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    },
    babysittersChildcare: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 900 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 22000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 220000 // LKR per year
      }
    },
    petCareAnimalServices: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 700 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 18000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 180000 // LKR per year
      }
    },
    donationsRaiseFund: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 12000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 120000 // LKR per year
      }
    }
  },

  // Marketplace & Shopping Category Slots
  marketplaceShopping: {
    rentPropertyBuyingSelling: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 2000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 50000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 500000 // LKR per year
      }
    },
    exclusiveGiftPacks: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    },
    souvenirsCollectibles: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 600 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 15000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 150000 // LKR per year
      }
    },
    jewelryGemSellers: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 35000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 350000 // LKR per year
      }
    },
    homeOfficeAccessoriesTech: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1200 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 30000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 300000 // LKR per year
      }
    },
    fashionBeautyClothing: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 25000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 250000 // LKR per year
      }
    },
    dailyGroceryEssentials: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    },
    organicHerbalProductsSpices: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 900 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 22000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 220000 // LKR per year
      }
    },
    booksMagazinesEducational: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 600 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 15000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 150000 // LKR per year
      }
    },
    otherItems: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 12000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 120000 // LKR per year
      }
    },
    createLinkOwnStore: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 45000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 450000 // LKR per year
      }
    }
  },

  // Entertainment & Fitness Category Slots
  entertainmentFitness: {
    exclusiveComboPackages: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 2500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 60000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 600000 // LKR per year
      }
    },
    talentedEntertainersArtists: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1200 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 30000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 300000 // LKR per year
      }
    },
    fitnessHealthSpasGym: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 35000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 350000 // LKR per year
      }
    },
    cinemaMovieHub: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 2000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 50000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 500000 // LKR per year
      }
    },
    socialMediaPromotions: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    }
  },

  // Special Opportunities Category Slots
  specialOpportunities: {
    jobOpportunities: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 25000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 250000 // LKR per year
      }
    },
    cryptoConsultingSignals: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 35000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 350000 // LKR per year
      }
    },
    localSimMobileData: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 800 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 20000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 200000 // LKR per year
      }
    },
    customAdsCampaigns: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 3000 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 75000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 750000 // LKR per year
      }
    },
    exclusiveOffersPromotions: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 1200 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 30000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 300000 // LKR per year
      }
    }
  },

  // Essential Services Category Slots
  essentialServices: {
    emergencyServicesInsurance: {
      dailyCharge: {
        type: Number,
        required: true,
        default: 2500 // LKR per day
      },
      monthlyCharge: {
        type: Number,
        required: true,
        default: 60000 // LKR per month
      },
      yearlyCharge: {
        type: Number,
        required: true,
        default: 600000 // LKR per year
      }
    }
  },

  // Global settings
  currency: {
    type: String,
    default: 'LKR'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    required: true,
    default: 'admin'
  }
}, {
  timestamps: true
});

// Ensure only one active configuration exists
advertisementSlotChargesSchema.pre('save', async function(next) {
  if (this.isActive && this.isNew) {
    await this.constructor.updateMany({}, { isActive: false });
  }
  next();
});

module.exports = mongoose.model('AdvertisementSlotCharges', advertisementSlotChargesSchema);
