from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Conversation, ChatMessage

User = get_user_model()


class ChatModelTests(TestCase):
    """Test chat models"""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )

    def test_conversation_creation(self):
        """Test creating a conversation"""
        conversation = Conversation.objects.create(
            conversation_type='direct',
            created_by=self.user1,
            title='Test Conversation'
        )

        self.assertEqual(conversation.conversation_type, 'direct')
        self.assertEqual(conversation.created_by, self.user1)
        self.assertEqual(str(conversation), 'Test Conversation')

    def test_add_participant(self):
        """Test adding participant to conversation"""
        conversation = Conversation.objects.create(
            conversation_type='direct',
            created_by=self.user1
        )

        # Add participant
        participant, created = conversation.add_participant(self.user2, added_by=self.user1)

        self.assertTrue(created)
        self.assertEqual(participant.user, self.user2)
        self.assertEqual(participant.added_by, self.user1)
        self.assertTrue(participant.is_active)
        self.assertEqual(participant.role, 'member')

    def test_chat_message_creation(self):
        """Test creating a chat message"""
        conversation = Conversation.objects.create(
            conversation_type='direct',
            created_by=self.user1
        )
        conversation.add_participant(self.user1, added_by=self.user1)
        conversation.add_participant(self.user2, added_by=self.user1)

        message = ChatMessage.objects.create(
            conversation=conversation,
            sender=self.user1,
            content='Hello, world!'
        )

        self.assertEqual(message.conversation, conversation)
        self.assertEqual(message.sender, self.user1)
        self.assertEqual(message.content, 'Hello, world!')
        self.assertEqual(message.message_type, 'text')


class ChatAPITests(APITestCase):
    """Test chat API endpoints"""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )

        # Create a conversation
        self.conversation = Conversation.objects.create(
            conversation_type='direct',
            created_by=self.user1,
            title='Test Chat'
        )
        self.conversation.add_participant(self.user1, added_by=self.user1)
        self.conversation.add_participant(self.user2, added_by=self.user1)

    def test_conversation_list_authenticated(self):
        """Test listing conversations for authenticated user"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.get('/api/notifications/conversations/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], 'Test Chat')

    def test_conversation_list_unauthenticated(self):
        """Test listing conversations without authentication"""
        response = self.client.get('/api/notifications/conversations/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_send_message(self):
        """Test sending a message to a conversation"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'conversation': str(self.conversation.id),
            'content': 'Hello from API test!'
        }

        response = self.client.post('/api/notifications/messages/', data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['content'], 'Hello from API test!')
        self.assertEqual(response.data['sender_details']['email'], 'user1@example.com')

        # Verify message was created in database
        message = ChatMessage.objects.get(id=response.data['id'])
        self.assertEqual(message.content, 'Hello from API test!')
        self.assertEqual(message.sender, self.user1)

    def test_get_conversation_messages(self):
        """Test getting messages for a conversation"""
        # Create a message
        ChatMessage.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content='Test message'
        )

        self.client.force_authenticate(user=self.user1)

        response = self.client.get(f'/api/notifications/conversations/{self.conversation.id}/messages/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['content'], 'Test message')
