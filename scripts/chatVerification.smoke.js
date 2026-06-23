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
        // TEST BUG 1: Empty / Whitespace-only Message Rejected (Bug 1 Fixed)
        // ==========================================
        console.log('\n--- Testing Bug 1: Empty / Whitespace-only Message validation ---');
        
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
        
        assert.equal(resData1.code, 400, 'Whitespace message should be rejected (Bug 1 fixed)');
        assert.equal(resData1.success, false);
        console.log('Bug 1 Resolution verified: Whitespace-only message successfully rejected.');

        // ==========================================
        // TEST BUG 3 & BUG 5: Chat History Bidirectional and Ascending Sorting (Bugs 3 & 5 Fixed)
        // ==========================================
        console.log('\n--- Testing Bug 3 & Bug 5: Bidirectional history & Ascending sort ---');

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
        // Bug 3 Resolution validation: both messages (sent and received) should be fetched
        const hasIncomingMsg = resData2.data.some(m => m.content.includes('Hi Customer'));
        assert.equal(hasIncomingMsg, true, 'Should return messages sent by User B (Bug 3 fixed)');
        console.log('Bug 3 Resolution verified: History endpoint returns messages from both directions.');

        // Bug 5 Resolution validation: sorted by createdAt in ascending order (oldest first)
        if (resData2.data.length > 1) {
            const dateFirst = new Date(resData2.data[0].createdAt).getTime();
            const dateSecond = new Date(resData2.data[1].createdAt).getTime();
            assert.ok(dateFirst <= dateSecond, 'History should be sorted oldest first (Bug 5 fixed)');
        }
        console.log('Bug 5 Resolution verified: Chat history is sorted in ascending order.');

        // ==========================================
        // TEST BUG 4: IDOR (Authorization check in history - Bug 4 Fixed)
        // ==========================================
        console.log('\n--- Testing Bug 4: IDOR Authorization check ---');
        
        // User C (malicious observer) requests history between User A and User B
        const userC_Id = new mongoose.Types.ObjectId();
        let req3 = {
            user: { id: userC_Id.toString(), roleId: 'R2' }, // Requesting user is User C (Regular User)
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
        assert.equal(resData3.code, 403, 'Endpoint should return 403 Forbidden for unauthorized users (Bug 4 fixed)');
        assert.equal(resData3.success, false);
        console.log('Bug 4 Resolution verified: IDOR blocked. Unauthorized user cannot view private messages.');

        // ==========================================
        // TEST BUG 6: Mark As Read Logic (marks received messages - Bug 6 Fixed)
        // ==========================================
        console.log('\n--- Testing Bug 6: Mark as Read Logic ---');

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

        assert.equal(dbMsg3.isRead, true, 'Incoming message from User B should be marked as read (Bug 6 fixed)');
        assert.equal(dbMsg2.isRead, false, 'User A\'s own sent message should remain unread (Bug 6 fixed)');
        console.log('Bug 6 Resolution verified: markAsRead correctly updates received messages.');

        console.log('\n==========================================');
        console.log('All backend chat bugs successfully resolved & verified!');
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
