import { useState, useEffect } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { supabase } from '@/lib/supabase/clientV2'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, Save, RotateCcw, GraduationCap, Star, TrendingUp, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface EvaluationCriteria {
  area: string
  weight: number
  description: string
}

interface CoachingPreferences {
  id?: string
  coaching_framework: string
  evaluation_criteria: EvaluationCriteria[]
  good_examples: string
  bad_examples: string
  good_example_meeting_ids: string[]
  bad_example_meeting_ids: string[]
  rating_scale: Record<string, string>
  custom_instructions: string
}

interface Meeting {
  id: string
  title: string
  meeting_start: string
  coach_rating: number | null
  sentiment_score: number | null
}

const DEFAULT_PREFERENCES: CoachingPreferences = {
  coaching_framework: 'Evaluate the sales representative\'s performance across key areas: discovery, objection handling, value articulation, closing technique, and relationship building.',
  evaluation_criteria: [
    {area: 'Discovery', weight: 20, description: 'How well did the rep uncover customer needs and pain points?'},
    {area: 'Listening', weight: 20, description: 'Did the rep actively listen and respond appropriately?'},
    {area: 'Value Articulation', weight: 20, description: 'How clearly did the rep communicate value and differentiation?'},
    {area: 'Objection Handling', weight: 20, description: 'How effectively did the rep address concerns and objections?'},
    {area: 'Next Steps', weight: 20, description: 'Did the rep secure clear next steps and commitment?'}
  ],
  good_examples: `GOOD EXAMPLES:
- "Tell me more about your current process..." (open-ended discovery)
- "Based on what you shared, here's how we can help..." (value alignment)
- "That's a great concern. Here's how we address that..." (confident objection handling)
- "Let's get that demo scheduled for next Tuesday - does 2pm work?" (clear next step)`,
  bad_examples: `BAD EXAMPLES:
- Talking more than 70% of the time (poor listening)
- Pitching features before understanding needs (premature presentation)
- Avoiding or dismissing objections (defensive behavior)
- Ending without clear next steps or commitment (weak closing)`,
  good_example_meeting_ids: [],
  bad_example_meeting_ids: [],
  rating_scale: {
    '1-3': 'Poor - Significant improvement needed. Multiple areas performed below standard.',
    '4-5': 'Below Average - Some good moments but key areas need work.',
    '6-7': 'Good - Solid performance with a few areas to improve.',
    '8-9': 'Excellent - Strong performance across most areas.',
    '10': 'Outstanding - Exceptional performance, best-in-class execution.'
  },
  custom_instructions: 'Focus on actionable feedback. Be specific about what was done well and what could be improved. Provide 2-3 concrete improvement suggestions.'
}

export default function CoachingPreferences() {
  const { userData: user } = useUser()
  const [preferences, setPreferences] = useState<CoachingPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [availableMeetings, setAvailableMeetings] = useState<Meeting[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)

  useEffect(() => {
    if (user) {
      loadPreferences()
      loadAvailableMeetings()
    }
  }, [user])

  const loadAvailableMeetings = async () => {
    try {
      setLoadingMeetings(true)
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, meeting_start, coach_rating, sentiment_score')
        .eq('owner_user_id', user?.id)
        .not('transcript_text', 'is', null)
        .order('meeting_start', { ascending: false })
        .limit(50)

      if (error) throw error
      setAvailableMeetings((data as any) || [])
    } catch (error) {
      console.error('Failed to load meetings:', error)
    } finally {
      setLoadingMeetings(false)
    }
  }

  const loadPreferences = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('user_coaching_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      if (data) {
        const typedData = data as any
        setPreferences({
          id: typedData.id,
          coaching_framework: typedData.coaching_framework,
          evaluation_criteria: typedData.evaluation_criteria,
          good_examples: typedData.good_examples,
          bad_examples: typedData.bad_examples,
          good_example_meeting_ids: typedData.good_example_meeting_ids || [],
          bad_example_meeting_ids: typedData.bad_example_meeting_ids || [],
          rating_scale: typedData.rating_scale,
          custom_instructions: typedData.custom_instructions,
        })
      }
    } catch (error) {
      console.error('Failed to load coaching preferences:', error)
      toast.error('Failed to load preferences')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      if (preferences.id) {
        // Update existing
        const { error } = await (supabase
          .from('user_coaching_preferences') as any)
          .update({
            coaching_framework: preferences.coaching_framework,
            evaluation_criteria: preferences.evaluation_criteria,
            good_examples: preferences.good_examples,
            bad_examples: preferences.bad_examples,
            good_example_meeting_ids: preferences.good_example_meeting_ids,
            bad_example_meeting_ids: preferences.bad_example_meeting_ids,
            rating_scale: preferences.rating_scale,
            custom_instructions: preferences.custom_instructions,
          })
          .eq('id', preferences.id)

        if (error) throw error
      } else {
        // Create new
        const { data, error } = await (supabase
          .from('user_coaching_preferences') as any)
          .insert({
            user_id: user?.id,
            coaching_framework: preferences.coaching_framework,
            evaluation_criteria: preferences.evaluation_criteria,
            good_examples: preferences.good_examples,
            bad_examples: preferences.bad_examples,
            good_example_meeting_ids: preferences.good_example_meeting_ids,
            bad_example_meeting_ids: preferences.bad_example_meeting_ids,
            rating_scale: preferences.rating_scale,
            custom_instructions: preferences.custom_instructions,
          })
          .select()
          .single()

        if (error) throw error
        if (data) {
          setPreferences({ ...preferences, id: data.id })
        }
      }

      toast.success('Coaching preferences saved successfully')
    } catch (error) {
      console.error('Failed to save coaching preferences:', error)
      toast.error('Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setPreferences(DEFAULT_PREFERENCES)
    toast.info('Reset to default preferences')
  }

  const updateCriteria = (index: number, field: keyof EvaluationCriteria, value: string | number) => {
    const newCriteria = [...preferences.evaluation_criteria]
    newCriteria[index] = { ...newCriteria[index], [field]: value }
    setPreferences({ ...preferences, evaluation_criteria: newCriteria })
  }

  const addCriteria = () => {
    setPreferences({
      ...preferences,
      evaluation_criteria: [
        ...preferences.evaluation_criteria,
        { area: 'New Area', weight: 20, description: 'Description' }
      ]
    })
  }

  const removeCriteria = (index: number) => {
    const newCriteria = preferences.evaluation_criteria.filter((_, i) => i !== index)
    setPreferences({ ...preferences, evaluation_criteria: newCriteria })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="w-8 h-8" />
            Sales Coaching Preferences
          </h1>
          <p className="text-muted-foreground mt-2">
            Customize how AI analyzes and provides coaching feedback on your sales calls
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Coaching Framework */}
      <Card className="p-6">
        <Label htmlFor="framework" className="text-lg font-semibold flex items-center gap-2">
          <Star className="w-5 h-5" />
          Coaching Framework
        </Label>
        <p className="text-sm text-muted-foreground mb-4">
          Define the overall philosophy and approach for evaluating sales calls
        </p>
        <Textarea
          id="framework"
          value={preferences.coaching_framework}
          onChange={(e) => setPreferences({ ...preferences, coaching_framework: e.target.value })}
          rows={3}
          className="w-full"
        />
      </Card>

      {/* Evaluation Criteria */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Label className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Evaluation Criteria
            </Label>
            <p className="text-sm text-muted-foreground">
              Define the specific areas to evaluate and their relative importance
            </p>
          </div>
          <Button onClick={addCriteria} variant="outline" size="sm">
            Add Criteria
          </Button>
        </div>
        <div className="space-y-4">
          {preferences.evaluation_criteria.map((criteria, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-start p-4 border rounded-lg">
              <div className="col-span-3">
                <Label className="text-xs">Area</Label>
                <Input
                  value={criteria.area}
                  onChange={(e) => updateCriteria(index, 'area', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Weight (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={criteria.weight}
                  onChange={(e) => updateCriteria(index, 'weight', parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-6">
                <Label className="text-xs">Description</Label>
                <Input
                  value={criteria.description}
                  onChange={(e) => updateCriteria(index, 'description', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="col-span-1 flex items-end justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCriteria(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Good Examples */}
      <Card className="p-6">
        <Label htmlFor="good-examples" className="text-lg font-semibold text-green-600">
          ✓ Good Examples
        </Label>
        <p className="text-sm text-muted-foreground mb-4">
          Provide examples of excellent sales techniques to look for
        </p>
        <Textarea
          id="good-examples"
          value={preferences.good_examples}
          onChange={(e) => setPreferences({ ...preferences, good_examples: e.target.value })}
          rows={6}
          className="w-full font-mono text-sm"
        />
      </Card>

      {/* Bad Examples */}
      <Card className="p-6">
        <Label htmlFor="bad-examples" className="text-lg font-semibold text-red-600">
          ✗ Bad Examples
        </Label>
        <p className="text-sm text-muted-foreground mb-4">
          Provide examples of techniques to avoid or improve
        </p>
        <Textarea
          id="bad-examples"
          value={preferences.bad_examples}
          onChange={(e) => setPreferences({ ...preferences, bad_examples: e.target.value })}
          rows={6}
          className="w-full font-mono text-sm"
        />
      </Card>

      {/* Reference Meeting Examples */}
      <Card className="p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border-2 border-green-200 dark:border-green-800">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
              📞 Reference Meeting Examples (NEW!)
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Instead of just text examples, reference actual recorded meetings! AI will analyze these calls and use them as benchmarks when coaching.
            </p>
          </div>
        </div>

        {/* Good Example Meetings */}
        <div className="mb-6">
          <Label className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Excellent Call Examples ({preferences.good_example_meeting_ids.length} selected)
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Select up to 3 meetings that demonstrate excellent sales technique
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loadingMeetings ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              availableMeetings.map((meeting) => (
                <label
                  key={meeting.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={preferences.good_example_meeting_ids.includes(meeting.id)}
                    onChange={(e) => {
                      const newIds = e.target.checked
                        ? [...preferences.good_example_meeting_ids, meeting.id].slice(0, 3)
                        : preferences.good_example_meeting_ids.filter(id => id !== meeting.id)
                      setPreferences({ ...preferences, good_example_meeting_ids: newIds })
                    }}
                    disabled={!preferences.good_example_meeting_ids.includes(meeting.id) && preferences.good_example_meeting_ids.length >= 3}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{meeting.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(meeting.meeting_start).toLocaleDateString()}
                      {meeting.coach_rating && ` • Rating: ${meeting.coach_rating}/10`}
                      {meeting.sentiment_score && ` • Sentiment: ${(meeting.sentiment_score * 100).toFixed(0)}%`}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Bad Example Meetings */}
        <div>
          <Label className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Calls to Avoid ({preferences.bad_example_meeting_ids.length} selected)
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Select up to 3 meetings that demonstrate techniques to avoid or improve
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loadingMeetings ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              availableMeetings.map((meeting) => (
                <label
                  key={meeting.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={preferences.bad_example_meeting_ids.includes(meeting.id)}
                    onChange={(e) => {
                      const newIds = e.target.checked
                        ? [...preferences.bad_example_meeting_ids, meeting.id].slice(0, 3)
                        : preferences.bad_example_meeting_ids.filter(id => id !== meeting.id)
                      setPreferences({ ...preferences, bad_example_meeting_ids: newIds })
                    }}
                    disabled={!preferences.bad_example_meeting_ids.includes(meeting.id) && preferences.bad_example_meeting_ids.length >= 3}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{meeting.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(meeting.meeting_start).toLocaleDateString()}
                      {meeting.coach_rating && ` • Rating: ${meeting.coach_rating}/10`}
                      {meeting.sentiment_score && ` • Sentiment: ${(meeting.sentiment_score * 100).toFixed(0)}%`}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Custom Instructions */}
      <Card className="p-6">
        <Label htmlFor="custom-instructions" className="text-lg font-semibold">
          Custom Instructions
        </Label>
        <p className="text-sm text-muted-foreground mb-4">
          Additional guidance for AI on how to provide feedback
        </p>
        <Textarea
          id="custom-instructions"
          value={preferences.custom_instructions}
          onChange={(e) => setPreferences({ ...preferences, custom_instructions: e.target.value })}
          rows={3}
          className="w-full"
        />
      </Card>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
