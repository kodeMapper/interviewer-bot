import sys
import random
import os

# Add root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.mock_interview_controller import MockInterviewController
from tests.scenarios import SCENARIOS

def run_random_test():
    print("=========================================")
    print("   AUTOMATED INTERVIEW TESTER (v1.0)     ")
    print("=========================================")
    
    scenario_name = random.choice(list(SCENARIOS.keys()))
    scenario_data = SCENARIOS[scenario_name]
    
    print(f"\n[SELECTED SCENARIO]: {scenario_name}")
    print(f"[DESCRIPTION]: {scenario_data['description']}")
    print("-----------------------------------------\n")
    
    controller = MockInterviewController(scenario_name, scenario_data)
    
    try:
        controller.run_loop()
    except Exception as e:
        print(f"\n[TEST FAILED] Exception: {e}")
        import traceback
        traceback.print_exc()
        
    print(f"\n[TEST COMPLETE] Verified Scenario: {scenario_name}")

if __name__ == "__main__":
    run_random_test()
