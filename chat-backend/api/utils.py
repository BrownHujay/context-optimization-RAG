from bson import ObjectId

def object_id_to_str(obj):
    """Convert MongoDB ObjectId to string in response objects"""
    if obj is None:
        return None
    
    if isinstance(obj, list):
        return [object_id_to_str(item) for item in obj]
    
    if isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            if key == "_id":
                result["id"] = str(value)
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, (dict, list)):
                result[key] = object_id_to_str(value)
            else:
                result[key] = value
        return result
    
    return obj
