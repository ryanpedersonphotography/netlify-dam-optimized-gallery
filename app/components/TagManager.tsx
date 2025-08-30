'use client';

import { useState, useEffect } from 'react';

interface TagManagerProps {
  assetKey: string;
  onTagsChange?: (tags: string[]) => void;
}

export default function TagManager({ assetKey, onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetchTags();
    fetchAllTags();
  }, [assetKey]);

  const fetchTags = async () => {
    try {
      const response = await fetch(`/api/tag-handler/get?key=${encodeURIComponent(assetKey)}`);
      const data = await response.json();
      if (data.tags) {
        setTags(data.tags);
        onTagsChange?.(data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchAllTags = async () => {
    try {
      const response = await fetch('/api/tag-handler/all');
      const data = await response.json();
      if (data.tags) {
        setSuggestions(data.tags.map((t: any) => t.name));
      }
    } catch (error) {
      console.error('Error fetching all tags:', error);
    }
  };

  const addTag = async () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;

    setLoading(true);
    try {
      const response = await fetch('/api/tag-handler/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: assetKey,
          tag: newTag.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        setTags(data.tags);
        setNewTag('');
        onTagsChange?.(data.tags);
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeTag = async (tag: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/tag-handler/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: assetKey,
          tag
        })
      });

      const data = await response.json();
      if (data.success) {
        setTags(data.tags);
        onTagsChange?.(data.tags);
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(newTag.toLowerCase()) && !tags.includes(s)
  );

  return (
    <div className="space-y-3">
      {/* Current Tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              disabled={loading}
              className="ml-2 hover:text-blue-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Add New Tag */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add a tag..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={addTag}
            disabled={loading || !newTag.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {newTag && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => setNewTag(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}