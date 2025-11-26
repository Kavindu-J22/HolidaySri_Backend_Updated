const mongoose = require('mongoose');
const DonationsRaiseFund = require('../models/DonationsRaiseFund');
require('dotenv').config();

/**
 * Script to clean up duplicate donation campaigns
 * This script finds and removes duplicate campaigns based on publishedAdId,
 * keeping only the most recent one.
 */

async function cleanupDuplicateCampaigns() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find all campaigns
    const allCampaigns = await DonationsRaiseFund.find({}).sort({ createdAt: -1 });
    console.log(`Total campaigns found: ${allCampaigns.length}`);

    // Group campaigns by publishedAdId
    const campaignsByAdId = new Map();
    
    for (const campaign of allCampaigns) {
      const adId = campaign.publishedAdId.toString();
      
      if (!campaignsByAdId.has(adId)) {
        campaignsByAdId.set(adId, []);
      }
      
      campaignsByAdId.get(adId).push(campaign);
    }

    // Find duplicates
    let duplicateCount = 0;
    let deletedCount = 0;
    const idsToDelete = [];

    for (const [adId, campaigns] of campaignsByAdId.entries()) {
      if (campaigns.length > 1) {
        duplicateCount++;
        console.log(`\nFound ${campaigns.length} campaigns for publishedAdId: ${adId}`);
        
        // Sort by createdAt descending (most recent first)
        campaigns.sort((a, b) => b.createdAt - a.createdAt);
        
        // Keep the first one (most recent), mark others for deletion
        const toKeep = campaigns[0];
        const toDelete = campaigns.slice(1);
        
        console.log(`  Keeping campaign ID: ${toKeep._id} (created: ${toKeep.createdAt})`);
        
        for (const campaign of toDelete) {
          console.log(`  Deleting campaign ID: ${campaign._id} (created: ${campaign.createdAt})`);
          idsToDelete.push(campaign._id);
          deletedCount++;
        }
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total campaigns: ${allCampaigns.length}`);
    console.log(`Duplicate groups found: ${duplicateCount}`);
    console.log(`Campaigns to delete: ${deletedCount}`);

    if (idsToDelete.length > 0) {
      // Ask for confirmation (in production, you might want to add a CLI prompt)
      console.log('\nDeleting duplicate campaigns...');
      
      const result = await DonationsRaiseFund.deleteMany({
        _id: { $in: idsToDelete }
      });
      
      console.log(`Successfully deleted ${result.deletedCount} duplicate campaigns`);
    } else {
      console.log('\nNo duplicates found. Database is clean!');
    }

    // Verify the cleanup
    const remainingCampaigns = await DonationsRaiseFund.find({});
    console.log(`\nRemaining campaigns: ${remainingCampaigns.length}`);

    // Check if there are still any duplicates
    const remainingByAdId = new Map();
    for (const campaign of remainingCampaigns) {
      const adId = campaign.publishedAdId.toString();
      remainingByAdId.set(adId, (remainingByAdId.get(adId) || 0) + 1);
    }

    let stillHasDuplicates = false;
    for (const [adId, count] of remainingByAdId.entries()) {
      if (count > 1) {
        console.log(`WARNING: Still has ${count} campaigns for publishedAdId: ${adId}`);
        stillHasDuplicates = true;
      }
    }

    if (!stillHasDuplicates) {
      console.log('\n✓ Cleanup successful! No duplicates remaining.');
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the cleanup
cleanupDuplicateCampaigns();

