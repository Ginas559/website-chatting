import assert from 'assert/strict';
import mongoose from 'mongoose';
import User from '../src/models/user.js';
import ChatMessage from '../src/models/chatMessage.model.js';
import { sendMessage, getHistory, markAsRead } from '../src/controllers/chat.controller.js';

require('dotenv').config();

const run = async () => {
    const mongoUri = process.env.MONGO_DB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/btvn01';
    await mongoose.connect(mongoUri);

    console.log('Connected to MongoDB. Starting Chat Flow Smoke Test...');

    let userA = null;
    let userB = null;
    let msgId1 = null;
    let msgId2 = null;
    let msgId3 = null;

    try {
        // Create Test Users
        userA = await User.create({
            email: `usera_${Date.now()}@test.com`,
            password: 'password123',
            firstName: 'UserA',
            lastName: 'Customer',
            roleId: 'R2',
            isActive: true,
        });

        userB = await User.create({
            email: `userb_${Date.now()}@test.com`,
            password: 'password123',
            firstName: 'UserB',
            lastName: 'SupportAdmin',
            roleId: 'R1',
            isActive: true,
        });

        console.log(`Created test users: User A (${userA._id}) and User B (${userB._id})`);

        // ==========================================
        // TEST BUG 1: Empty / Whitespace-only Message Bypassed
        // ==========================================
        console.log('\n--- Testing Bug 1: Empty / Whitespace-only Message check bypass ---');
        
        // Mock req/res for sendMessage
        let req1 = {
            user: { id: userA._id.toString() },
            body: { receiverId: userB._id.toString(), content: '   ' } // whitespace message
        };
        let resData1 = null;
        let res1 = {
            status: (code) => ({
                json: (data) => {
                    resData1 = { code, ...data };
                }
            })
        };

        await sendMessage(req1, res1);
        
        assert.equal(resData1.code, 200, 'Whitespace message should be accepted (due to Bug 1)');
        assert.ok(resData1.message, 'ChatMessage should have been created');
        assert.equal(resData1.message.content, '   ');
        msgId1 = resData1.message._id;
        console.log('Bug 1 verified: Whitespace-only message accepted and saved in DB.');

        // ==========================================
        // TEST BUG 3 & BUG 5: Chat History Incorrect Query (One-way) and Descending Sorting
        // ==========================================
        console.log('\n--- Testing Bug 3 & Bug 5: One-way history & Descending sort ---');

        // Create standard messages
        // Msg 2: Sent by User A
        const m2 = await ChatMessage.create({
            senderId: userA._id,
            receiverId: userB._id,
            content: 'Hello Support Agent'
        });
        msgId2 = m2._id;

        // Msg 3: Sent by User B (Wait 1s to ensure distinct timestamps)
        await new Promise(resolve => setTimeout(resolve, 1000));
        const m3 = await ChatMessage.create({
            senderId: userB._id,
            receiverId: userA._id,
            content: 'Hi Customer, how can I help you?'
        });
        msgId3 = m3._id;

        // Fetch history as User A
        let req2 = {
            user: { id: userA._id.toString() },
            params: { senderId: userA._id.toString(), receiverId: userB._id.toString() }
        };
        let resData2 = null;
        let res2 = {
            status: (code) => ({
                json: (data) => {
                    resData2 = { code, ...data };
                }
            })
        };

        await getHistory(req2, res2);

        assert.equal(resData2.code, 200);
        // Bug 3 validation: only messages where senderId = User A should be fetched
        const hasIncomingMsg = resData2.data.some(m => m.content.includes('Hi Customer'));
        assert.equal(hasIncomingMsg, false, 'Should NOT return messages sent by User B (due to Bug 3 query logic)');
        console.log('Bug 3 verified: History endpoint only fetches messages sent by User A (one-way history).');

        // Bug 5 validation: sorted by createdAt in descending order
        if (resData2.data.length > 1) {
            const dateFirst = new Date(resData2.data[0].createdAt).getTime();
            const dateSecond = new Date(resData2.data[1].createdAt).getTime();
            assert.ok(dateFirst >= dateSecond, 'History should be sorted newest first (due to Bug 5)');
        }
        console.log('Bug 5 verified: Chat history is sorted in descending order.');

        // ==========================================
        // TEST BUG 4: IDOR (No authorization check in history)
        // ==========================================
        console.log('\n--- Testing Bug 4: IDOR (No authentication/ownership validation) ---');
        
        // User C (malicious observer) requests history between User A and User B
        const userC_Id = new mongoose.Types.ObjectId();
        let req3 = {
            user: { id: userC_Id.toString() }, // Requesting user is User C
            params: { senderId: userA._id.toString(), receiverId: userB._id.toString() }
        };
        let resData3 = null;
        let res3 = {
            status: (code) => ({
                json: (data) => {
                    resData3 = { code, ...data };
                }
            })
        };

        await getHistory(req3, res3);
        assert.equal(resData3.code, 200, 'Endpoint should return 200 OK without verifying ownership');
        assert.ok(resData3.data.length > 0, 'Should leakage private chat data to unauthorized user');
        console.log('Bug 4 verified: IDOR is active. Unauthorized user can view private messages.');

        // ==========================================
        // TEST BUG 6: Mark As Read Logic Error (marks sender\'s messages instead of receiver\'s)
        // ==========================================
        console.log('\n--- Testing Bug 6: Mark as Read Logic Error ---');

        // We want to mark messages sent by User B as read.
        // User A (receiver) calls the endpoint.
        let req4 = {
            user: { id: userA._id.toString() }, // receiverId
            params: { senderId: userB._id.toString() } // senderId
        };
        let resData4 = null;
        let res4 = {
            status: (code) => ({
                json: (data) => {
                    resData4 = { code, ...data };
                }
            })
        };

        await markAsRead(req4, res4);

        assert.equal(resData4.code, 200);

        // Fetch both messages and check isRead status
        const dbMsg2 = await ChatMessage.findById(msgId2); // Sent by User A
        const dbMsg3 = await ChatMessage.findById(msgId3); // Sent by User B

        assert.equal(dbMsg3.isRead, false, 'Incoming message from User B should remain unread (due to Bug 6 logic)');
        assert.equal(dbMsg2.isRead, true, 'User A\'s own sent message is incorrectly marked as read (due to Bug 6)');
        console.log('Bug 6 verified: markAsRead updates own sent messages instead of received messages.');

        console.log('\n==========================================');
        console.log('All backend chat bugs successfully verified!');
        console.log('==========================================');

    } finally {
        // Cleanup Test Data
        console.log('\nCleaning up test data...');
        if (userA) await User.deleteOne({ _id: userA._id });
        if (userB) await User.deleteOne({ _id: userB._id });
        if (msgId1) await ChatMessage.deleteOne({ _id: msgId1 });
        if (msgId2) await ChatMessage.deleteOne({ _id: msgId2 });
        if (msgId3) await ChatMessage.deleteOne({ _id: msgId3 });
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB. Cleanup complete.');
    }
};

run().catch((error) => {
    console.error('Test run failed:', error);
    process.exitCode = 1;
});
