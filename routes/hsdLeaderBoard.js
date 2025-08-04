const express = require('express');
const PaymentActivity = require('../models/PaymentActivity');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

// Helper function to get current 2-month period
const getCurrentPeriod = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  // Determine which 2-month period we're in
  let periodStart, periodEnd, periodName;

  if (month >= 0 && month <= 1) { // Jan-Feb
    periodStart = new Date(year, 0, 1); // Jan 1
    periodEnd = new Date(year, 2, 0, 23, 59, 59, 999); // Last day of Feb
    periodName = `January - February ${year}`;
  } else if (month >= 2 && month <= 3) { // Mar-Apr
    periodStart = new Date(year, 2, 1); // Mar 1
    periodEnd = new Date(year, 4, 0, 23, 59, 59, 999); // Last day of Apr
    periodName = `March - April ${year}`;
  } else if (month >= 4 && month <= 5) { // May-Jun
    periodStart = new Date(year, 4, 1); // May 1
    periodEnd = new Date(year, 6, 0, 23, 59, 59, 999); // Last day of Jun
    periodName = `May - June ${year}`;
  } else if (month >= 6 && month <= 7) { // Jul-Aug
    periodStart = new Date(year, 6, 1); // Jul 1
    periodEnd = new Date(year, 8, 0, 23, 59, 59, 999); // Last day of Aug
    periodName = `July - August ${year}`;
  } else if (month >= 8 && month <= 9) { // Sep-Oct
    periodStart = new Date(year, 8, 1); // Sep 1
    periodEnd = new Date(year, 10, 0, 23, 59, 59, 999); // Last day of Oct
    periodName = `September - October ${year}`;
  } else { // Nov-Dec
    periodStart = new Date(year, 10, 1); // Nov 1
    periodEnd = new Date(year + 1, 0, 0, 23, 59, 59, 999); // Last day of Dec
    periodName = `November - December ${year}`;
  }

  return {
    start: periodStart,
    end: periodEnd,
    name: periodName
  };
};

// Get HSD Leader Board
router.get('/', verifyToken, async (req, res) => {
  try {
    const currentPeriod = getCurrentPeriod();

    // Get top HSC spenders for current period
    const leaderBoard = await PaymentActivity.aggregate([
      {
        $match: {
          paymentMethod: 'HSC',
          status: 'completed',
          createdAt: {
            $gte: currentPeriod.start,
            $lte: currentPeriod.end
          }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalSpent: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userId'
        }
      },
      {
        $unwind: '$userId'
      },
      {
        $project: {
          userId: {
            _id: '$userId._id',
            name: '$userId.name',
            email: '$userId.email',
            profileImage: '$userId.profileImage'
          },
          totalSpent: 1,
          transactionCount: 1
        }
      },
      {
        $sort: { totalSpent: -1 }
      },
      {
        $limit: 50 // Show top 50 users
      }
    ]);

    // Get current user's rank
    let userRank = null;
    if (req.user) {
      const userSpending = await PaymentActivity.aggregate([
        {
          $match: {
            userId: req.user._id,
            paymentMethod: 'HSC',
            status: 'completed',
            createdAt: {
              $gte: currentPeriod.start,
              $lte: currentPeriod.end
            }
          }
        },
        {
          $group: {
            _id: '$userId',
            totalSpent: { $sum: '$amount' }
          }
        }
      ]);

      if (userSpending.length > 0) {
        const userTotal = userSpending[0].totalSpent;
        
        // Count how many users have spent more
        const usersAbove = await PaymentActivity.aggregate([
          {
            $match: {
              paymentMethod: 'HSC',
              status: 'completed',
              createdAt: {
                $gte: currentPeriod.start,
                $lte: currentPeriod.end
              }
            }
          },
          {
            $group: {
              _id: '$userId',
              totalSpent: { $sum: '$amount' }
            }
          },
          {
            $match: {
              totalSpent: { $gt: userTotal }
            }
          },
          {
            $count: 'count'
          }
        ]);

        userRank = {
          rank: (usersAbove[0]?.count || 0) + 1,
          totalSpent: userTotal
        };
      }
    }

    res.json({
      leaderBoard,
      currentPeriod: {
        start: currentPeriod.start,
        end: currentPeriod.end,
        name: currentPeriod.name
      },
      userRank
    });

  } catch (error) {
    console.error('Get HSD leader board error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process period end rewards (called by cron job)
router.post('/process-period-end', async (req, res) => {
  try {
    const currentPeriod = getCurrentPeriod();
    const now = new Date();

    // Check if we're at the end of the period (within last hour)
    const timeUntilEnd = currentPeriod.end.getTime() - now.getTime();
    const oneHour = 60 * 60 * 1000;

    if (timeUntilEnd > oneHour) {
      return res.json({ message: 'Not yet time to process period end rewards' });
    }

    // Get top 3 HSC spenders for the ending period
    const top3Users = await PaymentActivity.aggregate([
      {
        $match: {
          paymentMethod: 'HSC',
          status: 'completed',
          createdAt: {
            $gte: currentPeriod.start,
            $lte: currentPeriod.end
          }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalSpent: { $sum: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $sort: { totalSpent: -1 }
      },
      {
        $limit: 3
      }
    ]);

    const results = [];

    // Process each top 3 user
    for (let i = 0; i < top3Users.length; i++) {
      const userEntry = top3Users[i];
      const user = userEntry.user;
      const rank = i + 1;

      try {
        // Increment HSD balance by 1
        await User.findByIdAndUpdate(
          user._id,
          { $inc: { hsdBalance: 1 } }
        );

        // Create notification
        await Notification.create({
          userId: user._id,
          title: `🎉 HSD Leader Board Winner!`,
          message: `Congratulations! You ranked #${rank} in the ${currentPeriod.name} HSD Leader Board and earned +1 HSD Diamond!`,
          type: 'reward',
          isRead: false
        });

        // Send congratulations email
        const emailSubject = `🎉 Congratulations! You're a HSD Leader Board Winner!`;
        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
              <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">HSD Leader Board Winner</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">Dear ${user.name},</h2>
              
              <p style="color: #666; line-height: 1.6; font-size: 16px;">
                We're thrilled to announce that you've achieved <strong>Rank #${rank}</strong> in the 
                <strong>${currentPeriod.name}</strong> HSD Leader Board competition!
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <h3 style="color: #667eea; margin: 0 0 10px 0;">Your Achievement</h3>
                <p style="margin: 0; font-size: 18px; color: #333;">
                  <strong>Total HSC Spent:</strong> ${userEntry.totalSpent.toLocaleString()} HSC<br>
                  <strong>Reward:</strong> +1 HSD Diamond 💎
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6;">
                Your dedication to the Holidaysri platform has earned you this prestigious reward. 
                The HSD Diamond has been automatically added to your wallet and can be used for premium advertisements.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL}/hsc" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 12px 30px; text-decoration: none; 
                          border-radius: 25px; font-weight: bold; display: inline-block;">
                  View Your Wallet
                </a>
              </div>
              
              <p style="color: #666; line-height: 1.6; font-size: 14px; margin-top: 30px;">
                Thank you for being a valued member of the Holidaysri community. Keep exploring and earning!
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                This is an automated message from Holidaysri.com<br>
                If you have any questions, please contact our support team.
              </p>
            </div>
          </div>
        `;

        await sendEmail(user.email, emailSubject, emailContent);

        results.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          rank: rank,
          totalSpent: userEntry.totalSpent,
          status: 'success'
        });

      } catch (error) {
        console.error(`Error processing rewards for user ${user._id}:`, error);
        results.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          rank: rank,
          totalSpent: userEntry.totalSpent,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`HSD Leader Board period end processed for ${currentPeriod.name}:`, results);

    res.json({
      message: 'Period end rewards processed successfully',
      period: currentPeriod.name,
      results
    });

  } catch (error) {
    console.error('Process period end rewards error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
