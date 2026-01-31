"""
Gemini Client
Robust Google Gemini API client with retry logic, rate limiting, and error handling.

Uses GEMINI_API_KEY from .env file.
Drop-in replacement for GPT client.
"""

import os
import time
import json
from typing import Optional, Callable, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import threading

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv()


class GeminiModel(Enum):
    """Available Gemini models (as of 2026)."""
    GEMINI_2_5_FLASH = "models/gemini-2.5-flash"  # Latest, best free tier
    GEMINI_2_5_PRO = "models/gemini-2.5-pro"  # Most capable
    GEMINI_2_FLASH = "models/gemini-2.0-flash"  # Fast
    GEMINI_2_FLASH_LITE = "models/gemini-2.0-flash-lite"  # Fastest, cheapest
    GEMINI_FLASH_LATEST = "models/gemini-flash-latest"  # Latest flash


@dataclass
class GeminiConfig:
    """Configuration for Gemini API calls."""
    model: str = "models/gemini-2.5-flash"  # Latest model with best free tier
    max_tokens: int = 16384  # Increased significantly for 20+ detailed questions
    temperature: float = 0.7
    max_retries: int = 5  # More retries for robustness
    retry_delay: float = 2.0  # Longer initial delay
    timeout: float = 120.0  # Longer timeout for large outputs
    
    # Rate limiting
    min_request_interval: float = 1.0  # Increased to avoid rate limits


# Alias for backward compatibility with GPT client
GPTConfig = GeminiConfig


class GeminiClientError(Exception):
    """Base exception for Gemini client errors."""
    pass


class GeminiRateLimitError(GeminiClientError):
    """Rate limit exceeded."""
    pass


class GeminiTimeoutError(GeminiClientError):
    """Request timed out."""
    pass


class GeminiAPIError(GeminiClientError):
    """General API error."""
    pass


# Aliases for backward compatibility
GPTClientError = GeminiClientError
GPTRateLimitError = GeminiRateLimitError
GPTTimeoutError = GeminiTimeoutError
GPTAPIError = GeminiAPIError


class GeminiClient:
    """
    Robust Google Gemini API client with:
    - Automatic retries with exponential backoff
    - Rate limiting
    - Callback for progress updates
    - Thread-safe operations
    """
    
    def __init__(self, api_key: Optional[str] = None, config: Optional[GeminiConfig] = None):
        """
        Initialize Gemini client.
        
        Args:
            api_key: Gemini API key. If None, reads from GEMINI_API_KEY env var.
            config: Configuration options.
        """
        # Try GEMINI_API_KEY first, then fall back to GPT_API_KEY for compatibility
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GPT_API_KEY")
        
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY not found. Set it in .env file or pass directly."
            )
        
        self.config = config or GeminiConfig()
        
        # Initialize Gemini client - try new SDK first, then fall back to old
        self._gemini_available = False
        self.model = None
        self.genai = None
        self._use_new_sdk = False
        
        try:
            # Try new google-genai SDK first
            from google import genai
            from google.genai import types
            
            self.client = genai.Client(api_key=self.api_key)
            self.genai = genai
            self._types = types
            self._gemini_available = True
            self._use_new_sdk = True
            print(f"   [Gemini] Client initialized with model: {self.config.model} (new SDK)")
        except ImportError:
            try:
                # Fall back to old deprecated SDK
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self.genai = genai
                self.model = genai.GenerativeModel(self.config.model)
                self._gemini_available = True
                self._use_new_sdk = False
                print(f"   [Gemini] Client initialized with model: {self.config.model} (legacy SDK)")
            except ImportError:
                print("   [Gemini] Warning: No Gemini SDK installed. Run: pip install google-genai")
                self._gemini_available = False
        
        # Rate limiting
        self._rate_limit_lock = threading.Lock()
        self._last_request_time = 0
        
        # Token tracking
        self.total_input_tokens = 0
        self.total_output_tokens = 0
    
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        on_progress: Optional[Callable[[str], None]] = None,
        json_mode: bool = False
    ) -> str:
        """
        Generate completion with retry logic.
        
        Args:
            prompt: User message
            system_prompt: System context (instructions for the model)
            on_progress: Callback for streaming updates (not used currently)
            json_mode: If True, request JSON output
            
        Returns:
            Generated text response
            
        Raises:
            GeminiClientError: On API errors after retries exhausted
        """
        if not self._gemini_available:
            raise GeminiClientError("Gemini client not available")
        
        # Build the full prompt
        full_prompt = ""
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n"
        
        full_prompt += prompt
        
        # Add JSON instruction if needed
        if json_mode:
            full_prompt += "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no extra text."
        
        return self._call_with_retry(full_prompt, json_mode)
    
    def generate_with_file(
        self,
        prompt: str,
        file_path: str,
        system_prompt: Optional[str] = None,
        json_mode: bool = False
    ) -> str:
        """
        Generate completion with a file (PDF/image) uploaded directly to Gemini.
        Uses Gemini's multimodal capability to read the file directly.
        
        Args:
            prompt: User message
            file_path: Path to PDF or image file
            system_prompt: System context (instructions for the model)
            json_mode: If True, request JSON output
            
        Returns:
            Generated text response
        """
        if not self._gemini_available:
            raise GeminiClientError("Gemini client not available")
        
        import os
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Build the full prompt
        full_prompt = ""
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n"
        full_prompt += prompt
        
        if json_mode:
            full_prompt += "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no extra text."
        
        return self._call_with_file_retry(full_prompt, file_path, json_mode)
    
    def _call_with_file_retry(self, prompt: str, file_path: str, json_mode: bool) -> str:
        """Execute API call with file upload and retry logic."""
        import os
        
        last_error = None
        
        for attempt in range(self.config.max_retries):
            try:
                self._apply_rate_limit()
                
                print(f"   [Gemini] Uploading file: {os.path.basename(file_path)}...")
                
                if self._use_new_sdk:
                    # New google-genai SDK - read file and upload
                    with open(file_path, 'rb') as f:
                        file_data = f.read()
                    
                    # Determine MIME type
                    ext = os.path.splitext(file_path)[1].lower()
                    mime_type = {
                        '.pdf': 'application/pdf',
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                    }.get(ext, 'application/pdf')
                    
                    # Upload file
                    uploaded_file = self.client.files.upload(
                        file=file_path,
                        config={"mime_type": mime_type}
                    )
                    
                    print(f"   [Gemini] File uploaded. Generating response...")
                    
                    config = self._types.GenerateContentConfig(
                        max_output_tokens=self.config.max_tokens,
                        temperature=self.config.temperature,
                    )
                    
                    if json_mode:
                        config.response_mime_type = "application/json"
                    
                    response = self.client.models.generate_content(
                        model=self.config.model,
                        contents=[uploaded_file, prompt],
                        config=config
                    )
                    
                    # Clean up
                    try:
                        self.client.files.delete(name=uploaded_file.name)
                    except:
                        pass
                    
                    if response.text:
                        return response.text
                    else:
                        raise GeminiAPIError("Empty response from Gemini")
                else:
                    # Legacy SDK
                    uploaded_file = self.genai.upload_file(file_path)
                    
                    # Wait for processing
                    import time
                    while uploaded_file.state.name == "PROCESSING":
                        time.sleep(1)
                        uploaded_file = self.genai.get_file(uploaded_file.name)
                    
                    if uploaded_file.state.name == "FAILED":
                        raise GeminiAPIError(f"File upload failed: {uploaded_file.state.name}")
                    
                    print(f"   [Gemini] File uploaded. Generating response...")
                    
                    generation_config = {
                        "max_output_tokens": self.config.max_tokens,
                        "temperature": self.config.temperature,
                    }
                    
                    if json_mode:
                        generation_config["response_mime_type"] = "application/json"
                    
                    response = self.model.generate_content(
                        [uploaded_file, prompt],
                        generation_config=generation_config
                    )
                    
                    # Clean up
                    try:
                        self.genai.delete_file(uploaded_file.name)
                    except:
                        pass
                    
                    if response.text:
                        return response.text
                    elif response.candidates:
                        return response.candidates[0].content.parts[0].text
                    else:
                        raise GeminiAPIError("Empty response from Gemini")
                
            except Exception as e:
                error_str = str(e).lower()
                last_error = e
                
                if '429' in str(e) or 'rate' in error_str or 'quota' in error_str:
                    wait_time = self.config.retry_delay * (2 ** attempt)
                    print(f"   [Gemini] Rate limited. Waiting {wait_time:.1f}s... (attempt {attempt + 1})")
                    time.sleep(wait_time)
                    continue
                elif 'timeout' in error_str:
                    if attempt < self.config.max_retries - 1:
                        print(f"   [Gemini] Timeout. Retrying... (attempt {attempt + 1})")
                        continue
                else:
                    raise GeminiClientError(f"File generation error: {e}")
        
        raise GeminiClientError(f"Max retries exceeded. Last error: {last_error}")
    
    def _call_with_retry(self, prompt: str, json_mode: bool) -> str:
        """Execute API call with exponential backoff retry."""
        
        last_error = None
        
        for attempt in range(self.config.max_retries):
            try:
                # Apply rate limiting
                self._apply_rate_limit()
                
                if self._use_new_sdk:
                    # New google-genai SDK
                    config = self._types.GenerateContentConfig(
                        max_output_tokens=self.config.max_tokens,
                        temperature=self.config.temperature,
                    )
                    
                    if json_mode:
                        config.response_mime_type = "application/json"
                    
                    response = self.client.models.generate_content(
                        model=self.config.model,
                        contents=prompt,
                        config=config
                    )
                    
                    if response.text:
                        return response.text
                    else:
                        raise GeminiAPIError("Empty response from Gemini")
                else:
                    # Legacy SDK
                    generation_config = {
                        "max_output_tokens": self.config.max_tokens,
                        "temperature": self.config.temperature,
                    }
                    
                    if json_mode:
                        generation_config["response_mime_type"] = "application/json"
                    
                    response = self.model.generate_content(
                        prompt,
                        generation_config=generation_config
                    )
                    
                    if response.text:
                        return response.text
                    elif response.candidates:
                        return response.candidates[0].content.parts[0].text
                    else:
                        raise GeminiAPIError("Empty response from Gemini")
                
            except Exception as e:
                error_str = str(e).lower()
                last_error = e
                
                # Handle rate limiting (429)
                if '429' in str(e) or 'rate' in error_str or 'quota' in error_str:
                    wait_time = self.config.retry_delay * (2 ** attempt)
                    print(f"   [Gemini] Rate limited. Waiting {wait_time:.1f}s... (attempt {attempt + 1})")
                    time.sleep(wait_time)
                    continue
                
                # Handle timeout
                elif 'timeout' in error_str or 'deadline' in error_str:
                    if attempt < self.config.max_retries - 1:
                        print(f"   [Gemini] Timeout. Retrying... (attempt {attempt + 1})")
                        time.sleep(self.config.retry_delay)
                        continue
                    else:
                        raise GeminiTimeoutError(f"Request timed out after {self.config.max_retries} attempts")
                
                # Handle safety blocks
                elif 'safety' in error_str or 'blocked' in error_str:
                    raise GeminiAPIError(f"Content blocked by safety filters: {e}")
                
                # Handle other API errors
                elif 'api' in error_str or 'server' in error_str or '500' in str(e):
                    if attempt < self.config.max_retries - 1:
                        wait_time = self.config.retry_delay * (2 ** attempt)
                        print(f"   [Gemini] API error. Retrying in {wait_time:.1f}s... (attempt {attempt + 1})")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise GeminiAPIError(f"API error after {self.config.max_retries} attempts: {e}")
                
                # Unknown error - don't retry
                else:
                    raise GeminiClientError(f"Unexpected error: {e}")
        
        raise GeminiClientError(f"Max retries exceeded. Last error: {last_error}")
    
    def _apply_rate_limit(self):
        """Ensure minimum interval between requests."""
        with self._rate_limit_lock:
            elapsed = time.time() - self._last_request_time
            if elapsed < self.config.min_request_interval:
                time.sleep(self.config.min_request_interval - elapsed)
            self._last_request_time = time.time()
    
    def get_token_usage(self) -> Dict[str, int]:
        """Get total token usage for cost tracking."""
        return {
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens
        }
    
    def estimate_cost(self) -> float:
        """
        Estimate API cost.
        Gemini 1.5 Flash is free up to certain limits!
        """
        # Gemini 1.5 Flash is free for most use cases
        return 0.0
    
    def reset_usage(self):
        """Reset token usage counters."""
        self.total_input_tokens = 0
        self.total_output_tokens = 0
    
    def is_available(self) -> bool:
        """Check if the client is properly configured and available."""
        return self._gemini_available and self.model is not None
    
    def test_connection(self) -> bool:
        """Test the API connection with a minimal request."""
        try:
            response = self.generate(
                prompt="Say 'OK' and nothing else.",
                system_prompt="You are a test bot. Only respond with 'OK'."
            )
            return "ok" in response.lower()
        except Exception as e:
            print(f"   [Gemini] Connection test failed: {e}")
            return False


# Alias for backward compatibility
GPTClient = GeminiClient


# Convenience function
def create_gemini_client(model: str = "gemini-1.5-flash") -> GeminiClient:
    """Create a Gemini client with default configuration."""
    config = GeminiConfig(model=model)
    return GeminiClient(config=config)


# Alias for backward compatibility
def create_gpt_client(model: str = "gemini-1.5-flash") -> GeminiClient:
    """Create a Gemini client (backward compatible alias)."""
    return create_gemini_client(model)


# Standalone testing
if __name__ == "__main__":
    print("Testing Gemini Client...")
    
    try:
        client = create_gemini_client()
        
        if client.test_connection():
            print("✅ Connection successful!")
            
            # Test generation
            response = client.generate(
                prompt="What is 2 + 2? Answer in one word.",
                system_prompt="You are a math tutor. Give brief answers."
            )
            print(f"\nResponse: {response}")
            print(f"Estimated cost: ${client.estimate_cost()} (Gemini Flash is FREE!)")
        else:
            print("❌ Connection failed")
            
    except Exception as e:
        print(f"❌ Error: {e}")
