SCENARIOS = {
    "The Ideal Candidate": {
        "description": "Knows Java/Python, Answers correctly, triggers adaptive 'Threading' logic.",
        "script": [
            "I am a developer skilled in Java and Python.", # Intro
            "A HashMap uses a hash code to index values.", # Q1
            "I use Multi-threading often to improve performance.", # Q2 (Trigger 'threading')
            "Threads share the same memory space.", # Q3 (Should be about threading)
            "I am good with Lists.", # Q4
            "Python lists are mutable arrays.", # Q5 (First Python Q)
            "Decorators wrap functions.", # Q6
            "Terminate interview" # End
        ]
    },
    
    "The Quitter": {
        "description": "Tries to skip questions and then quits early.",
        "script": [
            "I know Java.", # Intro
            "I don't know, skip.", # Q1 -> Skip
            "I have no idea.", # Q2 -> Skip
            "Stop interview." # Q3 -> Terminate
        ]
    },
    
    "The Mixed Signal": {
        "description": "Java interview, but candidate mentions React terms. Bot should NOT switch to React.",
        "script": [
            "I am a backend engineer using Java.", # Intro (Only Java)
            "I typically build a React App with hooks.", # Q1 (Triggers 'react', 'hooks')
            "Another answer about the App.", # Q2 (Should STILL be Java)
            "Terminate interview"
        ]
    }
}
