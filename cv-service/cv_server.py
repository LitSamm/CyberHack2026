from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import random
import time
import asyncio

app = FastAPI(title="AromOS CV Service")

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Mock endpoint that simulates a Computer Vision model analyzing material quality.
    In a real scenario, this would load a .pt model (e.g., YOLO or ResNet),
    run inference on the uploaded image, and return the results.
    """
    # Simulate processing time (1.5 to 3 seconds)
    await asyncio.sleep(random.uniform(1.5, 3.0))

    # Generate realistic mock data
    color_grade = random.randint(3, 5)
    consistency_grade = random.randint(3, 5)
    contamination = random.choice([True, False, False, False]) # 25% chance of contamination
    
    # Calculate confidence based on simulated factors
    confidence = round(random.uniform(75.5, 99.9), 1)

    # Determine AI recommendation logic
    recommendation = "approve"
    defects = []

    if contamination:
        recommendation = "reject"
        defects.append("Foreign particles detected")
    elif color_grade <= 3 and consistency_grade <= 3:
        recommendation = "reject"
        defects.append("Poor color and consistency")
    elif color_grade < 4 or consistency_grade < 4:
        recommendation = "review"
        if color_grade < 4:
            defects.append("Slight discoloration")
        if consistency_grade < 4:
            defects.append("Uneven consistency")

    return {
        "color_grade": color_grade,
        "consistency_grade": consistency_grade,
        "contamination_detected": contamination,
        "confidence": confidence,
        "defects": defects,
        "recommendation": recommendation
    }

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
