import streamlit as st
import os
from openai import OpenAI
from dotenv import load_dotenv
import boto3
import random
from rich.console import Console

# Initialize console for nice output
console = Console()

class PromptTester:
    def __init__(self):
        # Load environment variables
        load_dotenv('.env')
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        self.client = OpenAI()  # Will automatically use OPENAI_API_KEY from environment
        
        # Initialize DynamoDB
        self.dynamodb = boto3.resource('dynamodb',
            aws_access_key_id=os.getenv('S3_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('S3_SECRET_ACCESS_KEY'),
            region_name=os.getenv('S3_REGION')
        )
        self.table = self.dynamodb.Table(os.getenv('DYNAMODB_ID_AND_TAG'))

    def get_random_assistant(self):
        """Get a random active assistant from DynamoDB"""
        response = self.table.scan(
            FilterExpression='attribute_exists(assistant_id) AND #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'active'}
        )
        
        items = response.get('Items', [])
        if not items:
            raise Exception("No active assistants found in DynamoDB")
            
        # Randomly select one assistant
        assistant = random.choice(items)
        return assistant.get('assistant_id'), assistant.get('title', 'Unknown')

def main():
    st.set_page_config(page_title="Prompt Tester", page_icon="📚")
    
    st.title("📚 Educational Book Prompt Tester")
    st.markdown("""
    This app helps test AI responses for educational book content. It uses OpenAI's API to generate
    responses based on specific book content stored in your system.
    """)

    # Initialize PromptTester
    try:
        tester = PromptTester()
        
        # Get random assistant
        if 'assistant_id' not in st.session_state or 'book_title' not in st.session_state:
            assistant_id, book_title = tester.get_random_assistant()
            st.session_state['assistant_id'] = assistant_id
            st.session_state['book_title'] = book_title

        # Display current book info
        st.sidebar.header("Current Book")
        st.sidebar.write(f"Title: {st.session_state['book_title']}")
        st.sidebar.write(f"Assistant ID: {st.session_state['assistant_id']}")

        # Button to get new random book
        if st.sidebar.button("Get Random Book"):
            assistant_id, book_title = tester.get_random_assistant()
            st.session_state['assistant_id'] = assistant_id
            st.session_state['book_title'] = book_title
            st.rerun()

        # User input
        user_input = st.text_area("Enter your question about the book:", height=100)
        
        if st.button("Get Response"):
            if user_input:
                with st.spinner("Generating response..."):
                    # Create a thread and message
                    thread = tester.client.beta.threads.create()
                    message = tester.client.beta.threads.messages.create(
                        thread_id=thread.id,
                        role="user",
                        content=user_input
                    )

                    # Create a run
                    run = tester.client.beta.threads.runs.create(
                        thread_id=thread.id,
                        assistant_id=st.session_state['assistant_id']
                    )

                    # Wait for completion
                    while True:
                        run = tester.client.beta.threads.runs.retrieve(
                            thread_id=thread.id,
                            run_id=run.id
                        )
                        if run.status == 'completed':
                            break
                        elif run.status == 'failed':
                            st.error("Failed to generate response")
                            return

                    # Get the response
                    messages = tester.client.beta.threads.messages.list(
                        thread_id=thread.id
                    )
                    
                    # Display the assistant's response
                    for msg in messages.data:
                        if msg.role == "assistant":
                            st.markdown("### Response:")
                            st.write(msg.content[0].text.value)
            else:
                st.warning("Please enter a question first.")

    except Exception as e:
        st.error(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()
