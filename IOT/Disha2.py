import pandas as pd
import requests
import time
from pymongo import MongoClient
from cryptography.fernet import Fernet
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeRegressor
from sklearn.preprocessing import LabelEncoder
import base64

# MongoDB Connection
client = MongoClient("mongodb://localhost:27017/")
db = client["HealthMonitor"]
collection = db["PatientRecords"]
approved_collection = db["ApprovedRecords"]

# ThingSpeak API details
READ_API_KEY = "YTVCJFHDQTVIDAVR"
READ_CHANNEL_ID = "2860404"

# Encryption Key Handling
KEY_FILE = "encryption_key.txt"

def load_encryption_key():
    try:
        with open(KEY_FILE, "rb") as f:
            key = f.read().strip()
            decoded_key = base64.urlsafe_b64decode(key)
            if len(decoded_key) != 32:
                raise ValueError("Invalid encryption key length.")
            return key
    except FileNotFoundError:
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as f:
            f.write(key)
        return key

encryption_key = load_encryption_key()
cipher = Fernet(encryption_key)

def encrypt_data(data):
    return cipher.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data):
    return cipher.decrypt(encrypted_data.encode()).decode()

# Fetch data from ThingSpeak
def read_thingspeak():
    url = f"https://api.thingspeak.com/channels/{READ_CHANNEL_ID}/feeds.json?api_key={READ_API_KEY}&results=1"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if "feeds" in data and data["feeds"]:
            latest_data = data["feeds"][-1]
            def safe_get(field):
                value = latest_data.get(field)
                return float(value) if value is not None else None  
            heart_rate, spo2, object_temp, ambient_temp, pressure = (
                safe_get("field1"), safe_get("field2"), safe_get("field3"), safe_get("field4"), safe_get("field5")
            )
            if None in [heart_rate, spo2, object_temp, ambient_temp, pressure]:
                return None
            return heart_rate, spo2, object_temp, ambient_temp, pressure
    return None

# Train Decision Tree and Predict Disease
def predict_disease(heart_rate, spo2, object_temp, ambient_temp, pressure):
    try:
        dataset = pd.read_csv("DATASET_HEALTH_2000.csv")
        required_columns = ['heart rate', 'spo2', 'object temperature', 'ambient temperature', 'pressure', 'disease']
        if not all(col in dataset.columns for col in required_columns):
            return "No Disease Detected"
        
        label_encoder = LabelEncoder()
        dataset['disease'] = label_encoder.fit_transform(dataset['disease'])
        
        X, y = dataset.iloc[:, :-1], dataset.iloc[:, -1]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        model = DecisionTreeRegressor()
        model.fit(X_train, y_train)
        
        input_data = pd.DataFrame([[heart_rate, spo2, object_temp, ambient_temp, pressure]], 
                                  columns=['heart rate', 'spo2', 'object temperature', 'ambient temperature', 'pressure'])
        
        disease_prediction = model.predict(input_data)[0]
        predicted_disease = label_encoder.inverse_transform([int(round(disease_prediction))])[0]
        
        return predicted_disease

    except Exception as e:
        print(f"Error in disease prediction: {e}")
        return "No Disease Detected"

# Function to check if data is normal
def is_data_normal(heart_rate, spo2, object_temp, ambient_temp):
    return (60 <= heart_rate <= 120 and
            95 <= spo2 <= 100 and
            30.5 <= object_temp <= 37.5 and
            20 <= ambient_temp <= 35)

# Main Execution Loop
if __name__ == "__main__":
    while True:
        data = read_thingspeak()
        if data:
            heart_rate, spo2, object_temp, ambient_temp, pressure = data
            print(f"Data Retrieved: HR={heart_rate}, SpO2={spo2}, Obj Temp={object_temp}, Amb Temp={ambient_temp}, Pressure={pressure}")
            
            disease = predict_disease(heart_rate, spo2, object_temp, ambient_temp, pressure)
            print(f"Predicted Disease: {disease}")
            
            block_data = f"HR={heart_rate}, SpO2={spo2}, Obj Temp={object_temp}, Amb Temp={ambient_temp}, Pressure={pressure}, Disease={disease}"
            encrypted_data = encrypt_data(block_data)

            record = {
                "heart_rate": heart_rate,
                "spo2": spo2,
                "object_temp": object_temp,
                "ambient_temp": ambient_temp,
                "pressure": pressure,
                "predicted_disease": disease,
                "encrypted_data": encrypted_data,
                "timestamp": time.time(),
                "approved": False,
                "alert": not is_data_normal(heart_rate, spo2, object_temp, ambient_temp),
            }

            if is_data_normal(heart_rate, spo2, object_temp, ambient_temp):
                record["approved"] = True
                approved_collection.insert_one(record)
                print("✅ Auto-approved and saved to DB.")
            else:
                collection.insert_one(record)
                print("⚠️ Abnormal data. Awaiting doctor approval. Saved to DB.")
        
        time.sleep(15) 