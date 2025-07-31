const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: [
      // Tourism And Travel Category
      'travel_buddys',
      'tour_guiders',
      'local_tour_packages',
      'customize_tour_package',
      'travelsafe_help_professionals',
      'rent_land_camping_parking',

      // Accommodation & Dining Category
      'hotels_accommodations',
      'cafes_restaurants',
      'foods_beverages',

      // Vehicles & Transport Category
      'vehicle_rentals_hire',
      'live_rides_carpooling',
      'professional_drivers',
      'vehicle_repairs_mechanics',

      // Events & Management Category
      'events_updates',
      'event_planners_coordinators',
      'creative_photographers',
      'decorators_florists',
      'salon_makeup_artists',
      'fashion_designers',

      // Professionals & Services Category
      'expert_doctors',
      'professional_lawyers',
      'advisors_counselors',
      'language_translators',
      'expert_architects',
      'trusted_astrologists',
      'delivery_partners',
      'graphics_it_tech_repair',
      'educational_tutoring',
      'currency_exchange',
      'other_professionals_services',

      // Caring & Donations Category
      'caregivers_time_currency',
      'babysitters_childcare',
      'pet_care_animal_services',
      'donations_raise_fund',

      // Marketplace & Shopping Category
      'rent_property_buying_selling',
      'exclusive_gift_packs',
      'souvenirs_collectibles',
      'jewelry_gem_sellers',
      'home_office_accessories_tech',
      'fashion_beauty_clothing',
      'daily_grocery_essentials',
      'organic_herbal_products_spices',
      'books_magazines_educational',
      'other_items',
      'create_link_own_store',

      // Entertainment & Fitness Category
      'exclusive_combo_packages',
      'talented_entertainers_artists',
      'fitness_health_spas_gym',
      'cinema_movie_hub',
      'social_media_promotions',

      // Special Opportunities Category
      'job_opportunities',
      'crypto_consulting_signals',
      'local_sim_mobile_data',
      'custom_ads_campaigns',
      'exclusive_offers_promotions',

      // Essential Services Category
      'emergency_services_insurance',

      // Legacy categories for backward compatibility
      'hotel', 'guide', 'vehicle', 'restaurant', 'other'
    ],
    required: true
  },
  slotType: {
    type: String,
    enum: ['home_banner', 'category_slot'],
    default: 'category_slot'
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  images: [{
    url: String,
    alt: String
  }],
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    district: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    website: String,
    whatsapp: String
  },
  pricing: {
    currency: {
      type: String,
      default: 'LKR'
    },
    priceRange: {
      min: Number,
      max: Number
    },
    priceDescription: String
  },
  features: [{
    type: String
  }],
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    availableDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    availableHours: {
      open: String,
      close: String
    }
  },
  hscCost: {
    type: Number,
    required: true,
    min: 1
  },
  duration: {
    type: Number, // Duration in days
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'expired', 'rejected'],
    default: 'draft'
  },
  publishedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  views: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPromoted: {
    type: Boolean,
    default: false
  },
  promotionExpires: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for search functionality
advertisementSchema.index({ title: 'text', description: 'text' });
advertisementSchema.index({ category: 1, status: 1 });
advertisementSchema.index({ 'location.city': 1, 'location.district': 1 });
advertisementSchema.index({ userId: 1 });

// Calculate expiry date before saving
advertisementSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'active' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + (this.duration * 24 * 60 * 60 * 1000));
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Advertisement', advertisementSchema);
